package com.vfxt.wallet.ui.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.vfxt.wallet.blockchain.networks.EvmNetwork
import com.vfxt.wallet.domain.models.WalletAccount
import com.vfxt.wallet.domain.models.WalletOverview
import com.vfxt.wallet.domain.repository.WalletRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class HomeUiState(
    val isLoading: Boolean = true,
    val isRefreshing: Boolean = false,
    val overview: WalletOverview? = null,
    val balanceHidden: Boolean = false,
    val errorMessage: String? = null,
    val network: EvmNetwork? = null,
)

@HiltViewModel
class HomeViewModel @Inject constructor(private val walletRepository: WalletRepository) : ViewModel() {
    private val _uiState = MutableStateFlow(HomeUiState())
    val uiState: StateFlow<HomeUiState> = _uiState.asStateFlow()

    val accounts: StateFlow<List<WalletAccount>> =
        walletRepository.accounts.stateIn(viewModelScope, SharingStarted.Eagerly, emptyList())

    private var loadJob: Job? = null

    init {
        viewModelScope.launch { walletRepository.network.collect { n -> _uiState.update { it.copy(network = n) } } }
        // Reload when the wallet, network, token list or local transactions change.
        viewModelScope.launch {
            combine(walletRepository.activeAccount.distinctUntilChanged(), walletRepository.changes) { a, _ -> a }
                .collect { load(isRefresh = false) }
        }
    }

    fun refresh() = load(isRefresh = true)

    fun toggleBalanceVisibility() = _uiState.update { it.copy(balanceHidden = !it.balanceHidden) }

    fun selectAccount(id: String) {
        viewModelScope.launch { walletRepository.selectAccount(id) }
    }

    private fun load(isRefresh: Boolean) {
        loadJob?.cancel()
        loadJob = viewModelScope.launch {
            _uiState.update { it.copy(isLoading = !isRefresh && it.overview == null, isRefreshing = isRefresh, errorMessage = null) }
            runCatching { walletRepository.loadOverview() }
                .onSuccess { overview ->
                    _uiState.update { it.copy(isLoading = false, isRefreshing = false, overview = overview) }
                }
                .onFailure {
                    _uiState.update {
                        it.copy(isLoading = false, isRefreshing = false, errorMessage = "We couldn't load your wallet. Check your connection and try again.")
                    }
                }
        }
    }
}
