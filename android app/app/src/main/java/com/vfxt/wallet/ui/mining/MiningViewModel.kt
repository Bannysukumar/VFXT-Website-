package com.vfxt.wallet.ui.mining

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import com.vfxt.wallet.domain.models.MiningOverview
import com.vfxt.wallet.domain.repository.MiningRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class MiningUiState(
    val isLoading: Boolean = true,
    val overview: MiningOverview? = null,
    val errorMessage: String? = null,
)

@HiltViewModel
class MiningViewModel @Inject constructor(private val miningRepository: MiningRepository) : ViewModel() {
    private val _uiState = MutableStateFlow(MiningUiState())
    val uiState: StateFlow<MiningUiState> = _uiState.asStateFlow()

    init {
        load()
    }

    fun load() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = it.overview == null, errorMessage = null) }
            runCatching { miningRepository.loadOverview() }
                .onSuccess { overview -> _uiState.update { it.copy(isLoading = false, overview = overview) } }
                .onFailure {
                    _uiState.update { it.copy(isLoading = false, errorMessage = "Mining status couldn't be loaded. Please try again.") }
                }
        }
    }
}
