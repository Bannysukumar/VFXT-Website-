package com.vfxt.wallet.ui.transfer

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.vfxt.wallet.blockchain.networks.EvmNetwork
import com.vfxt.wallet.blockchain.networks.Networks
import com.vfxt.wallet.blockchain.rpc.EvmRpc
import com.vfxt.wallet.blockchain.wallet.WalletKeyService
import com.vfxt.wallet.data.local.ChainStore
import com.vfxt.wallet.data.local.StoredNetwork
import com.vfxt.wallet.data.local.StoredToken
import com.vfxt.wallet.data.remote.ExplorerService
import com.vfxt.wallet.domain.models.ActivityItem
import com.vfxt.wallet.domain.models.Holding
import com.vfxt.wallet.domain.models.TokenInfo
import com.vfxt.wallet.domain.models.WalletAccount
import com.vfxt.wallet.domain.repository.WalletRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ReceiveState(val account: WalletAccount? = null, val network: EvmNetwork? = null, val tokens: List<TokenInfo> = emptyList())

@HiltViewModel
class ReceiveViewModel @Inject constructor(repository: WalletRepository) : ViewModel() {
    val state: StateFlow<ReceiveState> =
        combine(repository.activeAccount, repository.network, repository.tokens) { a, n, t -> ReceiveState(a, n, t.filter { it.isAvailable }) }
            .stateIn(viewModelScope, SharingStarted.Eagerly, ReceiveState())
}

data class ActivityState(
    val loading: Boolean = true,
    val items: List<ActivityItem> = emptyList(),
    val network: EvmNetwork? = null,
    val address: String? = null,
    val explorerConfigured: Boolean = false,
)

@HiltViewModel
class ActivityViewModel @Inject constructor(
    private val repository: WalletRepository,
    explorer: ExplorerService,
) : ViewModel() {
    private val _state = MutableStateFlow(ActivityState(explorerConfigured = explorer.isConfigured))
    val state: StateFlow<ActivityState> = _state.asStateFlow()

    init {
        viewModelScope.launch { repository.changes.collect { refresh() } }
    }

    fun refresh() {
        viewModelScope.launch {
            _state.update { it.copy(loading = it.items.isEmpty()) }
            val network = repository.network.first()
            val account = repository.activeAccount.first()
            val items = runCatching { repository.loadActivity() }.getOrDefault(emptyList())
            _state.update { it.copy(loading = false, items = items, network = network, address = account?.address) }
        }
    }
}

data class TokenDetailsState(
    val loading: Boolean = true,
    val holding: Holding? = null,
    val network: EvmNetwork? = null,
    val account: WalletAccount? = null,
)

@HiltViewModel
class TokenDetailsViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val repository: WalletRepository,
    private val chainStore: ChainStore,
) : ViewModel() {
    private val tokenKey: String = checkNotNull(savedStateHandle["tokenKey"])
    private val _state = MutableStateFlow(TokenDetailsState())
    val state: StateFlow<TokenDetailsState> = _state.asStateFlow()

    init {
        viewModelScope.launch {
            val overview = repository.loadOverview()
            _state.value = TokenDetailsState(
                loading = false,
                holding = overview.holdings.firstOrNull { it.token.key == tokenKey },
                network = repository.network.first(),
                account = overview.account,
            )
        }
    }

    fun hide(onDone: () -> Unit) {
        val s = _state.value
        val token = s.holding?.token ?: return
        val network = s.network ?: return
        viewModelScope.launch {
            if (token.isCustom) chainStore.removeCustomToken(network.id, token.contractAddress!!)
            else chainStore.setTokenHidden(network.id, token.key, hidden = true)
            onDone()
        }
    }
}

data class AddTokenState(
    val address: String = "",
    val checking: Boolean = false,
    val preview: StoredToken? = null,
    val error: String? = null,
    val network: EvmNetwork? = null,
)

/**
 * Adds a user-supplied BEP-20 token only after verifying on-chain that the address is a contract
 * on the active network and responds to decimals()/symbol(). Metadata is read from the chain,
 * never typed in by the user, so it can't be spoofed through this form.
 */
@HiltViewModel
class AddTokenViewModel @Inject constructor(
    private val rpc: EvmRpc,
    private val chainStore: ChainStore,
    private val repository: WalletRepository,
) : ViewModel() {
    private val _state = MutableStateFlow(AddTokenState())
    val state: StateFlow<AddTokenState> = _state.asStateFlow()

    init {
        viewModelScope.launch { repository.network.collect { n -> _state.update { it.copy(network = n) } } }
    }

    fun onAddressChange(value: String) {
        val trimmed = value.trim()
        _state.update { it.copy(address = trimmed, preview = null, error = null) }
        if (WalletKeyService.isValidAddress(trimmed)) lookup(trimmed)
    }

    private fun lookup(address: String) {
        val network = _state.value.network ?: return
        _state.update { it.copy(checking = true) }
        viewModelScope.launch {
            val existing = repository.tokens.first().any { it.contractAddress.equals(address, true) }
            if (existing) {
                _state.update { it.copy(checking = false, error = "This token is already in your list.") }
                return@launch
            }
            runCatching {
                if (!rpc.isContract(network, address)) error("No contract found at this address on ${network.name}.")
                val decimals = async { rpc.tokenDecimals(network, address) }
                val symbol = async { rpc.tokenSymbol(network, address) }
                val name = async { rpc.tokenName(network, address) }
                val d = decimals.await() ?: error("This contract doesn't look like a BEP-20 token (no decimals).")
                if (d !in 0..36) error("Unsupported token decimals: $d.")
                val s = symbol.await() ?: error("This contract doesn't report a token symbol.")
                StoredToken(network.id, address, s, name.await() ?: s, d)
            }.onSuccess { token ->
                _state.update { if (it.address == address) it.copy(checking = false, preview = token) else it }
            }.onFailure { e ->
                _state.update { if (it.address == address) it.copy(checking = false, error = e.message ?: "Couldn't read this token.") else it }
            }
        }
    }

    fun add(onDone: () -> Unit) {
        val token = _state.value.preview ?: return
        viewModelScope.launch {
            chainStore.addCustomToken(token)
            onDone()
        }
    }
}

data class NetworkUiState(
    val active: EvmNetwork? = null,
    val networks: List<EvmNetwork> = emptyList(),
    val showAdd: Boolean = false,
    val name: String = "",
    val rpcUrl: String = "",
    val chainId: String = "",
    val symbol: String = "",
    val explorerUrl: String = "",
    val saving: Boolean = false,
    val verifying: Boolean = false,
    val error: String? = null,
)

@HiltViewModel
class NetworkViewModel @Inject constructor(
    private val chainStore: ChainStore,
    private val rpc: EvmRpc,
) : ViewModel() {
    private val _state = MutableStateFlow(NetworkUiState())
    val state: StateFlow<NetworkUiState> = _state.asStateFlow()

    init {
        viewModelScope.launch {
            combine(chainStore.activeNetwork, chainStore.allNetworks) { active, networks ->
                active to networks
            }.collect { (active, networks) ->
                _state.update { it.copy(active = active, networks = networks) }
            }
        }
    }

    fun select(network: EvmNetwork) {
        viewModelScope.launch { chainStore.setActiveNetwork(network) }
    }

    fun openAdd() {
        _state.update {
            it.copy(
                showAdd = true,
                name = "",
                rpcUrl = "",
                chainId = "",
                symbol = "",
                explorerUrl = "",
                error = null,
                saving = false,
                verifying = false,
            )
        }
    }

    fun closeAdd() {
        _state.update { it.copy(showAdd = false, error = null, saving = false, verifying = false) }
    }

    fun onName(value: String) = _state.update { it.copy(name = value, error = null) }
    fun onRpc(value: String) = _state.update { it.copy(rpcUrl = value.trim(), error = null) }
    fun onChainId(value: String) = _state.update { it.copy(chainId = value.filter { ch -> ch.isDigit() }, error = null) }
    fun onSymbol(value: String) = _state.update { it.copy(symbol = value.trim().uppercase().take(12), error = null) }
    fun onExplorer(value: String) = _state.update { it.copy(explorerUrl = value.trim(), error = null) }

    fun removeCustom(network: EvmNetwork) {
        if (!network.isCustom) return
        viewModelScope.launch { chainStore.removeCustomNetwork(network.id) }
    }

    fun saveCustom() {
        val s = _state.value
        val name = s.name.trim()
        val rpcUrl = s.rpcUrl.trim()
        val symbol = s.symbol.trim().ifBlank { "ETH" }
        val chainId = s.chainId.toLongOrNull()
        when {
            name.isBlank() -> {
                _state.update { it.copy(error = "Enter a network name.") }
                return
            }
            !rpcUrl.startsWith("https://") -> {
                _state.update { it.copy(error = "RPC URL must start with https://") }
                return
            }
            chainId == null || chainId <= 0L -> {
                _state.update { it.copy(error = "Enter a valid chain ID.") }
                return
            }
            Networks.byChainId(chainId) != null || s.networks.any { it.chainId == chainId && !it.isCustom } -> {
                _state.update { it.copy(error = "Chain ID $chainId is already a built-in network. Select it from the list.") }
                return
            }
        }

        viewModelScope.launch {
            _state.update { it.copy(verifying = true, saving = true, error = null) }
            val verified = runCatching { rpc.probeChainId(rpcUrl) }.getOrNull()
            if (verified == null) {
                _state.update {
                    it.copy(
                        verifying = false,
                        saving = false,
                        error = "Couldn't reach that RPC. Check the URL and your connection.",
                    )
                }
                return@launch
            }
            if (verified != chainId) {
                _state.update {
                    it.copy(
                        verifying = false,
                        saving = false,
                        error = "RPC reports chain ID $verified, but you entered $chainId.",
                    )
                }
                return@launch
            }
            val stored = StoredNetwork(
                id = "custom-$chainId",
                name = name,
                shortName = name.take(14),
                chainId = chainId,
                nativeSymbol = symbol,
                rpcUrl = rpcUrl,
                explorerBaseUrl = s.explorerUrl.trim().ifBlank { "https://example.com" },
                isTestnet = false,
            )
            chainStore.addCustomNetwork(stored)
            _state.update { it.copy(showAdd = false, verifying = false, saving = false) }
        }
    }
}
