package com.vfxt.wallet.ui.wallet

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.vfxt.wallet.data.local.WalletSummary
import com.vfxt.wallet.data.local.WalletVault
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

enum class SecretKind { RecoveryPhrase, PrivateKey }

/** A secret currently on screen. Cleared as soon as the reveal sheet closes. */
data class RevealedSecret(val walletName: String, val kind: SecretKind, val value: String)

data class WalletManagementState(
    val wallets: List<WalletSummary> = emptyList(),
    val activeId: String? = null,
)

@HiltViewModel
class WalletManagementViewModel @Inject constructor(
    private val vault: WalletVault,
) : ViewModel() {

    val state: StateFlow<WalletManagementState> =
        combine(vault.wallets, vault.activeWalletId) { wallets, active -> WalletManagementState(wallets.orEmpty(), active) }
            .stateIn(viewModelScope, SharingStarted.Eagerly, WalletManagementState())

    private val _revealed = MutableStateFlow<RevealedSecret?>(null)
    val revealed: StateFlow<RevealedSecret?> = _revealed.asStateFlow()

    fun select(id: String) {
        viewModelScope.launch { vault.setActive(id) }
    }

    fun rename(id: String, name: String) {
        viewModelScope.launch { vault.rename(id, name) }
    }

    fun remove(id: String) {
        viewModelScope.launch { vault.remove(id) }
    }

    /** Call only after the user has re-authenticated with PIN or biometrics. */
    fun reveal(wallet: WalletSummary, kind: SecretKind) {
        viewModelScope.launch {
            val value = when (kind) {
                SecretKind.RecoveryPhrase -> vault.revealSecret(wallet.id)
                SecretKind.PrivateKey -> vault.revealPrivateKey(wallet.id)
            }
            _revealed.value = RevealedSecret(wallet.name, kind, value)
        }
    }

    fun hideSecret() {
        _revealed.value = null
    }

    override fun onCleared() = hideSecret()
}
