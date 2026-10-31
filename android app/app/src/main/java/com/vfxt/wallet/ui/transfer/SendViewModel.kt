package com.vfxt.wallet.ui.transfer

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.vfxt.wallet.blockchain.networks.EvmNetwork
import com.vfxt.wallet.blockchain.rpc.AccountKind
import com.vfxt.wallet.blockchain.rpc.EvmRpc
import com.vfxt.wallet.blockchain.rpc.NetworkUnavailableException
import com.vfxt.wallet.blockchain.transactions.TransactionService
import com.vfxt.wallet.blockchain.transactions.TransferException
import com.vfxt.wallet.blockchain.transactions.TransferQuote
import com.vfxt.wallet.blockchain.wallet.WalletKeyService
import com.vfxt.wallet.domain.models.TokenInfo
import com.vfxt.wallet.domain.models.WalletAccount
import com.vfxt.wallet.domain.repository.WalletRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.math.BigDecimal
import java.math.BigInteger
import javax.inject.Inject

enum class SendStage { Edit, Review, Broadcasting, Done }

data class SendUiState(
    val network: EvmNetwork? = null,
    val account: WalletAccount? = null,
    val tokens: List<TokenInfo> = emptyList(),
    val token: TokenInfo? = null,
    val recipient: String = "",
    val amountInput: String = "",
    val balance: BigInteger? = null,
    val stage: SendStage = SendStage.Edit,
    val quoting: Boolean = false,
    val quote: TransferQuote? = null,
    val error: String? = null,
    val recipientWarning: String? = null,
    val txHash: String? = null,
    /** "pending" | "confirmed" | "failed" */
    val txStatus: String? = null,
) {
    val recipientValid: Boolean get() = WalletKeyService.isValidAddress(recipient.trim())
    val balanceText: String? get() = balance?.let { b ->
        token?.let { BigDecimal(b).movePointLeft(it.decimals).stripTrailingZeros().toPlainString() }
    }
}

@HiltViewModel
class SendViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val repository: WalletRepository,
    private val transactions: TransactionService,
    private val rpc: EvmRpc,
) : ViewModel() {

    private val initialTokenKey: String? = savedStateHandle["tokenKey"]
    private val _state = MutableStateFlow(SendUiState(recipient = savedStateHandle.get<String>("recipient").orEmpty()))
    val state: StateFlow<SendUiState> = _state.asStateFlow()

    init {
        viewModelScope.launch {
            combine(repository.network, repository.tokens, repository.activeAccount) { n, t, a -> Triple(n, t, a) }
                .collect { (network, tokens, account) ->
                    val sendable = tokens.filter { it.isAvailable }
                    _state.update { s ->
                        val keep = s.token?.takeIf { cur -> sendable.any { it.key == cur.key && it.networkId == network.id } }
                        s.copy(
                            network = network,
                            account = account,
                            tokens = sendable,
                            token = keep ?: sendable.firstOrNull { it.key == initialTokenKey } ?: sendable.firstOrNull(),
                        )
                    }
                    refreshBalance()
                }
        }
        if (_state.value.recipient.isNotBlank()) onRecipientChange(_state.value.recipient)
    }

    fun selectToken(token: TokenInfo) {
        _state.update { it.copy(token = token, amountInput = "", balance = null, error = null) }
        refreshBalance()
    }

    fun onRecipientChange(value: String) {
        val trimmed = value.trim()
        _state.update { it.copy(recipient = trimmed, error = null, recipientWarning = null) }
        if (WalletKeyService.isValidAddress(trimmed)) checkRecipient(trimmed)
    }

    fun onAmountChange(value: String) {
        if (value.isEmpty() || Regex("^\\d{0,18}(\\.\\d{0,18})?$").matches(value)) {
            _state.update { it.copy(amountInput = value, error = null) }
        }
    }

    private fun refreshBalance() {
        val s = _state.value
        val network = s.network ?: return
        val token = s.token ?: return
        val account = s.account ?: return
        viewModelScope.launch {
            runCatching { transactions.balances(network, token, account.address).second }
                .onSuccess { bal -> _state.update { if (it.token?.key == token.key) it.copy(balance = bal) else it } }
        }
    }

    /** Warns about common, costly mistakes before the user reaches the review screen. */
    private fun checkRecipient(address: String) {
        val s = _state.value
        val network = s.network ?: return
        when {
            address.equals(s.account?.address, ignoreCase = true) ->
                _state.update { it.copy(recipientWarning = "This is your own address.") }
            s.tokens.any { it.contractAddress.equals(address, ignoreCase = true) } ->
                _state.update { it.copy(recipientWarning = "This is a token contract address. Tokens sent here are usually lost forever.") }
            else -> viewModelScope.launch {
                val warning = when (runCatching { rpc.accountKind(network, address) }.getOrNull()) {
                    AccountKind.Contract -> "This address is a smart contract. Make sure it can receive ${_state.value.token?.symbol}."
                    AccountKind.DelegatedWallet -> "This wallet uses a smart-account delegation (EIP-7702). Double-check it's the right recipient."
                    else -> null
                }
                if (warning != null) _state.update { if (it.recipient == address) it.copy(recipientWarning = warning) else it }
            }
        }
    }

    fun useMax() {
        val s = _state.value
        val network = s.network ?: return
        val token = s.token ?: return
        val account = s.account ?: return
        val target = s.recipient.takeIf { s.recipientValid } ?: account.address
        _state.update { it.copy(quoting = true, error = null) }
        viewModelScope.launch {
            runCatching {
                val (native, tokenBal) = transactions.balances(network, token, account.address)
                val probe = transactions.quote(network, token, account.address, target, if (token.contractAddress == null) BigInteger.ONE else tokenBal.max(BigInteger.ONE))
                val max = transactions.maxAmount(probe.copy(nativeBalance = native, tokenBalance = tokenBal))
                BigDecimal(max).movePointLeft(token.decimals).stripTrailingZeros().toPlainString()
            }.onSuccess { amount ->
                _state.update { it.copy(quoting = false, amountInput = if (amount == "0") "" else amount) }
            }.onFailure { e -> _state.update { it.copy(quoting = false, error = e.userMessage()) } }
        }
    }

    fun review() {
        val s = _state.value
        val network = s.network ?: return
        val token = s.token ?: return
        val account = s.account ?: return
        if (!s.recipientValid) {
            _state.update { it.copy(error = "Enter a valid BNB Smart Chain address (0x… 42 characters).") }
            return
        }
        val amount = transactions.parseAmount(s.amountInput, token.decimals)
        if (amount == null || amount.signum() <= 0) {
            _state.update { it.copy(error = "Enter a valid amount.") }
            return
        }
        if (s.recipient.equals(token.contractAddress, ignoreCase = true)) {
            _state.update { it.copy(error = "You can't send a token to its own contract address.") }
            return
        }
        _state.update { it.copy(quoting = true, error = null) }
        viewModelScope.launch {
            runCatching { transactions.quote(network, token, account.address, s.recipient, amount) }
                .onSuccess { quote ->
                    _state.update {
                        it.copy(
                            quoting = false,
                            quote = quote,
                            error = quote.problem,
                            stage = if (quote.problem == null) SendStage.Review else SendStage.Edit,
                        )
                    }
                }
                .onFailure { e -> _state.update { it.copy(quoting = false, error = e.userMessage()) } }
        }
    }

    fun backToEdit() = _state.update { it.copy(stage = SendStage.Edit, quote = null) }

    /** Call only after the user re-authenticated (PIN or biometrics). */
    fun confirmAndSend() {
        val s = _state.value
        val quote = s.quote ?: return
        val account = s.account ?: return
        _state.update { it.copy(stage = SendStage.Broadcasting, error = null) }
        viewModelScope.launch {
            runCatching { transactions.send(quote, account.id) }
                .onSuccess { hash ->
                    _state.update { it.copy(stage = SendStage.Done, txHash = hash, txStatus = TransactionService.STATUS_PENDING) }
                    val status = transactions.awaitReceipt(quote.network, hash)
                    _state.update { it.copy(txStatus = status) }
                }
                .onFailure { e -> _state.update { it.copy(stage = SendStage.Review, error = e.userMessage()) } }
        }
    }

    private fun Throwable.userMessage(): String = when (this) {
        is TransferException -> message ?: "Transfer failed."
        is NetworkUnavailableException -> message ?: "Network unavailable."
        else -> "Something went wrong. Please try again."
    }
}
