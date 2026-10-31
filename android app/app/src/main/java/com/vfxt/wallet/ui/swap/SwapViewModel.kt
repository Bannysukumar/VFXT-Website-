package com.vfxt.wallet.ui.swap

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.vfxt.wallet.blockchain.networks.EvmNetwork
import com.vfxt.wallet.blockchain.networks.Networks
import com.vfxt.wallet.blockchain.rpc.EvmRpc
import com.vfxt.wallet.blockchain.swap.SwapEstimate
import com.vfxt.wallet.blockchain.swap.SwapException
import com.vfxt.wallet.blockchain.swap.SwapGuard
import com.vfxt.wallet.blockchain.swap.SwapPreview
import com.vfxt.wallet.blockchain.swap.SwapProgress
import com.vfxt.wallet.blockchain.swap.SwapService
import com.vfxt.wallet.blockchain.swap.SwapToken
import com.vfxt.wallet.blockchain.tokens.TokenRegistry
import com.vfxt.wallet.blockchain.transactions.TransactionService
import com.vfxt.wallet.blockchain.wallet.WalletKeyService
import com.vfxt.wallet.data.local.ChainStore
import com.vfxt.wallet.domain.models.TokenInfo
import com.vfxt.wallet.domain.models.TokenKind
import com.vfxt.wallet.domain.models.WalletAccount
import com.vfxt.wallet.domain.repository.WalletRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.math.BigDecimal
import java.math.BigInteger
import javax.inject.Inject

enum class SwapStage { Edit, Review, Executing, Finished }
enum class SwapSide { From, To }

data class SwapUiState(
    val loading: Boolean = true,
    val account: WalletAccount? = null,
    val networks: List<EvmNetwork> = emptyList(),
    val activeNetworkIsTestnet: Boolean = false,
    val fromNetwork: EvmNetwork? = null,
    val toNetwork: EvmNetwork? = null,
    val fromToken: SwapToken? = null,
    val toToken: SwapToken? = null,
    val fromBalance: BigInteger? = null,
    val toBalance: BigInteger? = null,
    val amountInput: String = "",
    val slippage: BigDecimal = BigDecimal("0.005"),
    val estimate: SwapEstimate? = null,
    val estimating: Boolean = false,
    val estimateError: String? = null,
    val stage: SwapStage = SwapStage.Edit,
    val reviewing: Boolean = false,
    val preview: SwapPreview? = null,
    val error: String? = null,
    val notice: String? = null,
    val highImpactAcknowledged: Boolean = false,
    val progress: SwapProgress? = null,
) {
    val amountRaw: BigInteger? get() = fromToken?.let { TransactionService.parseAmount(amountInput, it.decimals) }?.takeIf { it.signum() > 0 }
    val insufficient: Boolean get() = amountRaw != null && fromBalance != null && amountRaw!! > fromBalance
    val isCrossChain: Boolean get() = fromNetwork != null && toNetwork != null && fromNetwork.chainId != toNetwork.chainId
}

@HiltViewModel
class SwapViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val repository: WalletRepository,
    private val chainStore: ChainStore,
    private val swaps: SwapService,
    private val rpc: EvmRpc,
) : ViewModel() {

    private val initialTokenKey: String? = savedStateHandle["fromTokenKey"]
    private val _state = MutableStateFlow(SwapUiState())
    val state: StateFlow<SwapUiState> = _state.asStateFlow()

    private var estimateJob: Job? = null
    private var executeJob: Job? = null

    init {
        viewModelScope.launch {
            val account = repository.activeAccount.first()
            val active = chainStore.currentNetwork()
            val networks = chainStore.allNetworks.first().filter(swaps::isSupported)
            val from = active.takeIf(swaps::isSupported) ?: Networks.BscMainnet
            val fromTokens = walletTokens(from)
            val fromToken = fromTokens.firstOrNull { it.address.lowercase() == initialTokenKey?.lowercase() || (initialTokenKey == "native" && it.isNative) }
                ?: fromTokens.first { it.isNative }
            val toToken = fromTokens.firstOrNull { it.symbol == "USDT" && it.key != fromToken.key }
                ?: fromTokens.firstOrNull { it.key != fromToken.key }
            _state.update {
                it.copy(
                    loading = false,
                    account = account,
                    networks = networks,
                    activeNetworkIsTestnet = active.isTestnet,
                    fromNetwork = from,
                    toNetwork = from,
                    fromToken = fromToken,
                    toToken = toToken,
                )
            }
            refreshBalances()
        }
    }

    /** The wallet's own tokens for [network] (built-in + user-added). Treated as trusted. */
    suspend fun walletTokens(network: EvmNetwork): List<SwapToken> {
        val custom = chainStore.customTokens.first().filter { it.networkId == network.id }.map {
            TokenInfo(it.symbol, it.name, it.decimals, network.id, TokenKind.Bep20, it.contract, isCustom = true)
        }
        return (TokenRegistry.defaultTokens(network) + custom).mapNotNull { swaps.toSwapToken(it, network) }.distinctBy { it.key }
    }

    /** Tokens offered in the picker: the wallet's tokens first, then LI.FI's verified list. */
    suspend fun pickerTokens(network: EvmNetwork): Pair<List<SwapToken>, List<SwapToken>> {
        val mine = walletTokens(network)
        val mineKeys = mine.map { it.key }.toSet()
        val listed = runCatching { swaps.tokens(network) }.getOrDefault(emptyList())
            .filterNot { it.key in mineKeys }
            .map { t -> if (t.priceUsd != null && t.priceUsd > MAX_PLAUSIBLE_PRICE) t.copy(priceUsd = null) else t }
            .sortedWith(
                compareBy<SwapToken> { t ->
                    val rank = POPULAR_SYMBOLS.indexOf(t.symbol.uppercase())
                    // Only rank as popular when the token also has a plausible market price; this keeps
                    // look-alike tokens reusing a famous symbol out of the top of the list.
                    if (rank >= 0 && t.priceUsd != null) rank else POPULAR_SYMBOLS.size + if (t.priceUsd != null) 0 else 1
                }.thenBy { it.symbol.lowercase() },
            )
        return mine to listed
    }

    /** Resolves a pasted contract address on-chain. Returned as unverified so the UI warns. */
    suspend fun lookupToken(network: EvmNetwork, address: String): SwapToken? {
        if (!WalletKeyService.isValidAddress(address)) return null
        return runCatching {
            if (!rpc.isContract(network, address)) return null
            val decimals = rpc.tokenDecimals(network, address) ?: return null
            val symbol = rpc.tokenSymbol(network, address) ?: return null
            SwapToken(network.chainId, address, symbol, rpc.tokenName(network, address) ?: symbol, decimals, verified = false)
        }.getOrNull()
    }

    fun selectNetwork(side: SwapSide, network: EvmNetwork) {
        viewModelScope.launch {
            val tokens = walletTokens(network)
            val native = tokens.first { it.isNative }
            _state.update { s ->
                when (side) {
                    SwapSide.From -> s.copy(fromNetwork = network, fromToken = native, fromBalance = null, amountInput = "")
                    SwapSide.To -> s.copy(
                        toNetwork = network,
                        toToken = tokens.firstOrNull { it.key != s.fromToken?.key && (it.symbol == "USDT" || it.symbol == "USDC") }
                            ?: tokens.firstOrNull { it.key != s.fromToken?.key },
                        toBalance = null,
                    )
                }.copy(estimate = null, error = null)
            }
            refreshBalances()
            scheduleEstimate()
        }
    }

    fun selectToken(side: SwapSide, token: SwapToken) {
        _state.update { s ->
            val swapped = when (side) {
                SwapSide.From -> if (token.key == s.toToken?.key) s.copy(fromToken = token, toToken = s.fromToken) else s.copy(fromToken = token, amountInput = "")
                SwapSide.To -> if (token.key == s.fromToken?.key) s.copy(toToken = token, fromToken = s.toToken) else s.copy(toToken = token)
            }
            swapped.copy(estimate = null, error = null, fromBalance = if (side == SwapSide.From) null else s.fromBalance)
        }
        refreshBalances()
        scheduleEstimate()
    }

    fun flip() {
        _state.update { s ->
            s.copy(
                fromNetwork = s.toNetwork, toNetwork = s.fromNetwork,
                fromToken = s.toToken, toToken = s.fromToken,
                fromBalance = s.toBalance, toBalance = s.fromBalance,
                amountInput = "", estimate = null, error = null,
            )
        }
        refreshBalances()
    }

    fun onAmountChange(value: String) {
        val decimals = _state.value.fromToken?.decimals ?: 18
        if (value.isEmpty() || Regex("^\\d{0,24}(\\.\\d{0,$decimals})?$").matches(value)) {
            _state.update { it.copy(amountInput = value, error = null) }
            scheduleEstimate()
        }
    }

    fun setPercentOfBalance(percent: Int) {
        val s = _state.value
        val token = s.fromToken ?: return
        val balance = s.fromBalance ?: return
        var raw = balance * BigInteger.valueOf(percent.toLong()) / BigInteger.valueOf(100)
        // Leave room for gas when spending the native coin.
        if (token.isNative && percent == 100) raw = (raw - NATIVE_GAS_RESERVE).max(BigInteger.ZERO)
        val text = BigDecimal(raw).movePointLeft(token.decimals).stripTrailingZeros().toPlainString()
        onAmountChange(if (raw.signum() == 0) "" else text)
    }

    fun setSlippage(value: BigDecimal) {
        if (value.signum() <= 0 || value > SwapGuard.MAX_SLIPPAGE) return
        _state.update { it.copy(slippage = value, estimate = null) }
        scheduleEstimate()
    }

    private fun refreshBalances() {
        val s = _state.value
        val owner = s.account?.address ?: return
        viewModelScope.launch {
            val from = s.fromToken?.let { t -> s.fromNetwork?.let { n -> runCatching { swaps.balance(n, t, owner) }.getOrNull() } }
            val to = s.toToken?.let { t -> s.toNetwork?.let { n -> runCatching { swaps.balance(n, t, owner) }.getOrNull() } }
            _state.update { cur ->
                cur.copy(
                    fromBalance = if (cur.fromToken?.key == s.fromToken?.key) from else cur.fromBalance,
                    toBalance = if (cur.toToken?.key == s.toToken?.key) to else cur.toBalance,
                )
            }
        }
    }

    private fun scheduleEstimate() {
        estimateJob?.cancel()
        val s = _state.value
        val amount = s.amountRaw
        val from = s.fromToken
        val to = s.toToken
        val fromNet = s.fromNetwork
        val toNet = s.toNetwork
        val owner = s.account?.address
        if (amount == null || from == null || to == null || fromNet == null || toNet == null || owner == null) {
            _state.update { it.copy(estimate = null, estimating = false, estimateError = null) }
            return
        }
        estimateJob = viewModelScope.launch {
            _state.update { it.copy(estimating = true, estimateError = null) }
            delay(450) // debounce typing
            runCatching { swaps.estimate(fromNet, toNet, from, to, amount, owner, s.slippage) }
                .onSuccess { est ->
                    _state.update {
                        it.copy(
                            estimating = false,
                            estimate = est,
                            estimateError = if (est == null) "No route found for this pair. Try a different token or amount." else null,
                        )
                    }
                }
                .onFailure { e -> _state.update { it.copy(estimating = false, estimate = null, estimateError = e.message ?: "Couldn't get a price.") } }
        }
    }

    fun review() {
        val s = _state.value
        val amount = s.amountRaw ?: return _state.update { it.copy(error = "Enter an amount.") }
        val from = s.fromToken ?: return
        val to = s.toToken ?: return
        val owner = s.account?.address ?: return
        if (s.insufficient) return _state.update { it.copy(error = "Insufficient ${from.symbol} balance.") }
        _state.update { it.copy(reviewing = true, error = null, notice = null) }
        viewModelScope.launch {
            runCatching { swaps.preview(s.fromNetwork!!, s.toNetwork!!, from, to, amount, owner, s.slippage) }
                .onSuccess { preview ->
                    _state.update {
                        it.copy(
                            reviewing = false,
                            preview = preview,
                            error = preview.problem,
                            stage = if (preview.problem == null) SwapStage.Review else SwapStage.Edit,
                            highImpactAcknowledged = false,
                        )
                    }
                }
                .onFailure { e -> _state.update { it.copy(reviewing = false, error = (e as? SwapException)?.message ?: e.message ?: "Couldn't prepare the swap.") } }
        }
    }

    fun acknowledgeHighImpact(value: Boolean) = _state.update { it.copy(highImpactAcknowledged = value) }

    fun backToEdit() = _state.update { it.copy(stage = SwapStage.Edit, preview = null, notice = null) }

    /** Call only after the user re-authenticated with PIN or biometrics. */
    fun confirmAndExecute() {
        val s = _state.value
        val preview = s.preview ?: return
        val account = s.account ?: return
        executeJob?.cancel()
        _state.update { it.copy(stage = SwapStage.Executing, progress = null, error = null) }
        executeJob = viewModelScope.launch {
            swaps.execute(preview, account.id, account.address).collect { progress ->
                when (progress) {
                    is SwapProgress.PriceChanged -> _state.update {
                        it.copy(
                            stage = SwapStage.Review,
                            preview = progress.fresh,
                            progress = null,
                            highImpactAcknowledged = false,
                            notice = "The price changed since you reviewed it. Check the new amounts and confirm again.",
                        )
                    }
                    is SwapProgress.Done, is SwapProgress.Failed -> _state.update { it.copy(stage = SwapStage.Finished, progress = progress) }
                    else -> _state.update { it.copy(progress = progress) }
                }
            }
        }
    }

    companion object {
        /** Native coin kept back when the user taps MAX, so the swap can still pay for gas. */
        private val NATIVE_GAS_RESERVE = BigInteger("2000000000000000") // 0.002

        /** No legitimate token trades anywhere near this; such prices come from broken pools. */
        private val MAX_PLAUSIBLE_PRICE = BigDecimal("1000000")

        private val POPULAR_SYMBOLS = listOf(
            "USDT", "USDC", "ETH", "WETH", "BTCB", "WBTC", "BNB", "WBNB", "DAI", "FDUSD", "CAKE", "LINK",
            "UNI", "AAVE", "XRP", "DOGE", "ADA", "DOT", "SOL", "TRX", "LTC", "POL", "MATIC", "AVAX",
            "ARB", "OP", "SHIB", "PEPE", "TON", "ATOM", "FIL", "NEAR",
        )
    }
}
