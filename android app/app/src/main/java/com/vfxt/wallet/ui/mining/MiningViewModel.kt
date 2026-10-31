package com.vfxt.wallet.ui.mining

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.vfxt.wallet.domain.models.BoosterPurchaseOrder
import com.vfxt.wallet.domain.models.MiningBooster
import com.vfxt.wallet.domain.models.MiningOverview
import com.vfxt.wallet.domain.repository.MiningRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class MiningUiState(
    val isLoading: Boolean = true,
    val overview: MiningOverview? = null,
    val errorMessage: String? = null,
    val actionInProgress: Boolean = false,
    val notice: String? = null,
    val boosters: List<MiningBooster> = emptyList(),
    val boostersLoading: Boolean = false,
    val showBoosters: Boolean = false,
    val pendingOrder: BoosterPurchaseOrder? = null,
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
                    _uiState.update {
                        it.copy(isLoading = false, errorMessage = "Mining status couldn't be loaded. Please try again.")
                    }
                }
        }
    }

    fun startMining() = runAction {
        miningRepository.startMining()
        "Mining session started."
    }

    fun stopMining() = runAction {
        miningRepository.stopMining()
        "Mining session stopped. Rewards will appear after the server confirms."
    }

    fun claimRewards() = runAction {
        miningRepository.claimRewards()
    }

    fun openBoosters() {
        viewModelScope.launch {
            _uiState.update {
                it.copy(showBoosters = true, boostersLoading = true, pendingOrder = null)
            }
            runCatching { miningRepository.listBoosters() }
                .onSuccess { list ->
                    _uiState.update { it.copy(boostersLoading = false, boosters = list) }
                }
                .onFailure { err ->
                    _uiState.update {
                        it.copy(
                            boostersLoading = false,
                            notice = err.message ?: "Could not load boosters.",
                        )
                    }
                }
        }
    }

    fun closeBoosters() {
        _uiState.update { it.copy(showBoosters = false, pendingOrder = null) }
    }

    fun selectBooster(boosterId: String) = runAction {
        val order = miningRepository.createBoosterPurchase(boosterId)
        _uiState.update { it.copy(pendingOrder = order) }
        "Confirm ${order.priceUsdt} USDT from your VFXT Wallet to activate this booster."
    }

    fun payWithVfxtWallet() {
        val order = _uiState.value.pendingOrder ?: return
        runAction {
            val message = miningRepository.payBoosterWithVfxtWallet(order)
            _uiState.update { it.copy(pendingOrder = null, showBoosters = false) }
            message
        }
    }

    fun consumeNotice() {
        _uiState.update { it.copy(notice = null) }
    }

    private fun runAction(block: suspend () -> String) {
        viewModelScope.launch {
            if (_uiState.value.actionInProgress) return@launch
            _uiState.update { it.copy(actionInProgress = true, notice = null, errorMessage = null) }
            runCatching { block() }
                .onSuccess { message ->
                    val overview = runCatching { miningRepository.loadOverview() }.getOrNull()
                    _uiState.update {
                        it.copy(actionInProgress = false, notice = message, overview = overview ?: it.overview)
                    }
                }
                .onFailure { err ->
                    _uiState.update {
                        it.copy(
                            actionInProgress = false,
                            notice = err.message ?: "Something went wrong. Please try again.",
                        )
                    }
                }
        }
    }
}
