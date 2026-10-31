package com.vfxt.wallet.ui.main

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.vfxt.wallet.core.designsystem.theme.ThemeMode
import com.vfxt.wallet.core.security.AppLockManager
import com.vfxt.wallet.core.security.PinManager
import com.vfxt.wallet.data.local.AppPreferences
import com.vfxt.wallet.data.local.WalletVault
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

/** App-wide state needed before any screen can decide where to go. */
data class AppState(
    /** False until the vault, PIN record and preferences have all been read. */
    val ready: Boolean = false,
    val onboardingComplete: Boolean = false,
    val hasWallet: Boolean = false,
    val pinSet: Boolean = false,
    val locked: Boolean = true,
    val themeMode: ThemeMode = ThemeMode.Dark,
) {
    val showLockScreen: Boolean get() = ready && hasWallet && pinSet && locked
}

@HiltViewModel
class AppViewModel @Inject constructor(
    private val preferences: AppPreferences,
    vault: WalletVault,
    pinManager: PinManager,
    lockManager: AppLockManager,
) : ViewModel() {

    init {
        viewModelScope.launch {
            vault.load()
            pinManager.load()
        }
    }

    private val storage = combine(vault.wallets, pinManager.isPinSet, lockManager.locked) { wallets, pinSet, locked ->
        Triple(wallets, pinSet, locked)
    }

    private val prefs = combine(preferences.onboardingComplete, preferences.themeMode) { onboarding, theme ->
        onboarding to theme
    }

    val state: StateFlow<AppState?> = combine(storage, prefs) { (wallets, pinSet, locked), (onboarding, theme) ->
        AppState(
            ready = wallets != null && pinSet != null,
            onboardingComplete = onboarding,
            hasWallet = !wallets.isNullOrEmpty(),
            pinSet = pinSet == true,
            locked = locked,
            themeMode = theme,
        )
    }.stateIn(viewModelScope, SharingStarted.Eagerly, null)

    fun setThemeMode(mode: ThemeMode) {
        viewModelScope.launch { preferences.setThemeMode(mode) }
    }

    fun setOnboardingComplete() {
        viewModelScope.launch { preferences.setOnboardingComplete() }
    }
}
