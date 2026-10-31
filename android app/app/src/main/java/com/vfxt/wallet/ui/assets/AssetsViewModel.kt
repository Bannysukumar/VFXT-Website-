package com.vfxt.wallet.ui.assets

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.distinctUntilChanged
import javax.inject.Inject
import com.vfxt.wallet.domain.models.WalletOverview
import com.vfxt.wallet.domain.repository.WalletRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class AssetsUiState(
    val isLoading: Boolean = true,
    val overview: WalletOverview? = null,
    val query: String = "",
    val errorMessage: String? = null,
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

    init {
        viewModelScope.launch { walletRepository.activeAccount.distinctUntilChanged().collect { load() } }
    }

    fun load() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = it.overview == null, errorMessage = null) }
            runCatching { walletRepository.loadOverview() }
                .onSuccess { overview -> _uiState.update { it.copy(isLoading = false, overview = overview) } }
                .onFailure { _uiState.update { it.copy(isLoading = false, errorMessage = "Assets couldn't be loaded. Please try again.") } }
        }
    }

    fun updateQuery(query: String) = _uiState.update { it.copy(query = query) }
}
