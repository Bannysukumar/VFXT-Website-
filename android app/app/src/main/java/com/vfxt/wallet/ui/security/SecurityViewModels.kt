package com.vfxt.wallet.ui.security

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.vfxt.wallet.core.security.AppLockManager
import com.vfxt.wallet.core.security.PinCheck
import com.vfxt.wallet.core.security.PinManager
import com.vfxt.wallet.data.local.AppPreferences
import com.vfxt.wallet.data.local.AutoLock
import com.vfxt.wallet.data.local.WalletVault
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Fixed-size digit buffer. Kept as a CharArray (never a String) so it can be wiped after use
 * instead of lingering in the string pool.
 */
internal class PinBuffer(private val size: Int = PinManager.PIN_LENGTH) {
    private val digits = CharArray(size)
    var count = 0
        private set

    val isFull get() = count == size

    fun add(c: Char): Boolean {
        if (count >= size || c !in '0'..'9') return false
        digits[count++] = c
        return true
    }

    fun removeLast() {
        if (count > 0) digits[--count] = '\u0000'
    }

    fun copy(): CharArray = digits.copyOf(count)

    fun matches(other: CharArray): Boolean = count == other.size && (0 until count).all { digits[it] == other[it] }

    fun clear() {
        digits.fill('\u0000')
        count = 0
    }
}

data class PinEntryState(
    val entered: Int = 0,
    val error: String? = null,
    val errorKey: Int = 0,
    val lockedUntil: Long? = null,
    val busy: Boolean = false,
)

/** Verifies the existing PIN. Used by the lock screen and before sensitive actions. */
@HiltViewModel
class PinVerifyViewModel @Inject constructor(
    private val pinManager: PinManager,
    preferences: AppPreferences,
) : ViewModel() {

    private val buffer = PinBuffer()
    private val _state = MutableStateFlow(PinEntryState())
    val state: StateFlow<PinEntryState> = _state.asStateFlow()

    val biometricEnabled: StateFlow<Boolean> =
        preferences.biometricEnabled.stateIn(viewModelScope, SharingStarted.Eagerly, false)

    private val _verified = Channel<Unit>(Channel.BUFFERED)
    val verified: Flow<Unit> = _verified.receiveAsFlow()

    fun reset() {
        buffer.clear()
        _state.value = PinEntryState()
    }

    fun onDigit(c: Char) {
        val s = _state.value
        if (s.busy || (s.lockedUntil ?: 0) > System.currentTimeMillis()) return
        if (!buffer.add(c)) return
        _state.update { it.copy(entered = buffer.count, error = null, lockedUntil = null) }
        if (buffer.isFull) verify()
    }

    fun onBackspace() {
        buffer.removeLast()
        _state.update { it.copy(entered = buffer.count, error = null) }
    }

    fun onBiometricSuccess() {
        buffer.clear()
        _verified.trySend(Unit)
    }

    private fun verify() {
        val attempt = buffer.copy()
        buffer.clear()
        _state.update { it.copy(busy = true) }
        viewModelScope.launch {
            val result = try {
                pinManager.verify(attempt)
            } finally {
                attempt.fill('\u0000')
            }
            when (result) {
                PinCheck.Success -> {
                    _state.value = PinEntryState()
                    _verified.send(Unit)
                }
                is PinCheck.Wrong -> _state.update {
                    it.copy(
                        entered = 0,
                        busy = false,
                        error = "Incorrect PIN · ${result.attemptsBeforeLockout} attempts left",
                        errorKey = it.errorKey + 1,
                    )
                }
                is PinCheck.LockedOut -> _state.update {
                    it.copy(entered = 0, busy = false, error = "Too many attempts", errorKey = it.errorKey + 1, lockedUntil = result.untilMillis)
                }
            }
        }
    }

    override fun onCleared() = buffer.clear()
}

@HiltViewModel
class LockViewModel @Inject constructor(private val lockManager: AppLockManager) : ViewModel() {
    fun unlock() = lockManager.unlock()
}

enum class PinSetupStage { Enter, Confirm }

data class PinSetupState(
    val stage: PinSetupStage = PinSetupStage.Enter,
    val entered: Int = 0,
    val error: String? = null,
    val errorKey: Int = 0,
    val saving: Boolean = false,
)

/** Two-step create/confirm flow for a new PIN (first-time setup and Change PIN). */
@HiltViewModel
class PinSetupViewModel @Inject constructor(
    private val pinManager: PinManager,
    private val lockManager: AppLockManager,
) : ViewModel() {

    private val first = PinBuffer()
    private val second = PinBuffer()
    private val _state = MutableStateFlow(PinSetupState())
    val state: StateFlow<PinSetupState> = _state.asStateFlow()

    private val _done = Channel<Unit>(Channel.BUFFERED)
    val done: Flow<Unit> = _done.receiveAsFlow()

    private val active get() = if (_state.value.stage == PinSetupStage.Enter) first else second

    fun onDigit(c: Char) {
        if (_state.value.saving || !active.add(c)) return
        _state.update { it.copy(entered = active.count, error = null) }
        if (!active.isFull) return
        if (_state.value.stage == PinSetupStage.Enter) {
            _state.update { it.copy(stage = PinSetupStage.Confirm, entered = 0) }
        } else {
            confirm()
        }
    }

    fun onBackspace() {
        active.removeLast()
        _state.update { it.copy(entered = active.count) }
    }

    private fun confirm() {
        val pin = second.copy()
        if (!first.matches(pin)) {
            pin.fill('\u0000')
            first.clear()
            second.clear()
            _state.update { PinSetupState(error = "PINs didn't match. Try again.", errorKey = it.errorKey + 1) }
            return
        }
        _state.update { it.copy(saving = true) }
        viewModelScope.launch {
            try {
                pinManager.setPin(pin)
            } finally {
                pin.fill('\u0000')
                first.clear()
                second.clear()
            }
            lockManager.unlock()
            _done.send(Unit)
        }
    }

    override fun onCleared() {
        first.clear()
        second.clear()
    }
}

data class SecuritySettingsState(
    val biometricEnabled: Boolean = false,
    val autoLock: AutoLock = AutoLock.OneMinute,
    val allBackedUp: Boolean = true,
)

@HiltViewModel
class SecuritySettingsViewModel @Inject constructor(
    private val preferences: AppPreferences,
    private val lockManager: AppLockManager,
    vault: WalletVault,
) : ViewModel() {

    fun lockNow() = lockManager.lock()

    val state: StateFlow<SecuritySettingsState> = combine(
        preferences.biometricEnabled,
        preferences.autoLock,
        vault.wallets.map { list -> list.orEmpty().all { it.backedUp } },
    ) { bio, lock, backedUp -> SecuritySettingsState(bio, lock, backedUp) }
        .stateIn(viewModelScope, SharingStarted.Eagerly, SecuritySettingsState())

    fun setBiometric(enabled: Boolean) {
        viewModelScope.launch { preferences.setBiometricEnabled(enabled) }
    }

    fun setAutoLock(autoLock: AutoLock) {
        viewModelScope.launch { preferences.setAutoLock(autoLock) }
    }
}
