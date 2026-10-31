package com.vfxt.wallet.ui.assets

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.vfxt.wallet.blockchain.networks.EvmNetwork
import com.vfxt.wallet.domain.models.WalletOverview
import com.vfxt.wallet.domain.repository.WalletRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class AssetsUiState(
    val isLoading: Boolean = true,
    val overview: WalletOverview? = null,
    val query: String = "",
    val errorMessage: String? = null,
    val network: EvmNetwork? = null,
) {
    val visibleHoldings
        get() = overview?.holdings.orEmpty().filter {
            query.isBlank() ||
                it.token.symbol.contains(query.trim(), ignoreCase = true) ||
                it.token.name.contains(query.trim(), ignoreCase = true)
        }
}

@HiltViewModel
class AssetsViewModel @Inject constructor(private val walletRepository: WalletRepository) : ViewModel() {
    private val _uiState = MutableStateFlow(AssetsUiState())
    val uiState: StateFlow<AssetsUiState> = _uiState.asStateFlow()
    private var loadJob: Job? = null

    init {
        viewModelScope.launch { walletRepository.network.collect { n -> _uiState.update { it.copy(network = n) } } }
        viewModelScope.launch {
            combine(walletRepository.activeAccount.distinctUntilChanged(), walletRepository.changes) { a, _ -> a }
                .collect { load() }
        }
    }

    fun load() {
        loadJob?.cancel()
        loadJob = viewModelScope.launch {
            _uiState.update { it.copy(isLoading = it.overview == null, errorMessage = null) }
            runCatching { walletRepository.loadOverview() }
                .onSuccess { overview -> _uiState.update { it.copy(isLoading = false, overview = overview) } }
                .onFailure { _uiState.update { it.copy(isLoading = false, errorMessage = "Assets couldn't be loaded. Please try again.") } }
        }
    }

    fun updateQuery(query: String) = _uiState.update { it.copy(query = query) }
}
