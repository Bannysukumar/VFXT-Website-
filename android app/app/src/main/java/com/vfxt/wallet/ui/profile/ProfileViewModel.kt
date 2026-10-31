package com.vfxt.wallet.ui.profile

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.vfxt.wallet.domain.models.WalletAccount
import com.vfxt.wallet.domain.repository.WalletRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import javax.inject.Inject

data class ProfileState(
    val activeAccount: WalletAccount? = null,
    val walletCount: Int = 0,
)

@HiltViewModel
class ProfileViewModel @Inject constructor(walletRepository: WalletRepository) : ViewModel() {
    val state: StateFlow<ProfileState> =
        combine(walletRepository.activeAccount, walletRepository.accounts) { active, all -> ProfileState(active, all.size) }
            .stateIn(viewModelScope, SharingStarted.Eagerly, ProfileState())
}
