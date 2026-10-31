package com.vfxt.wallet.core.security

import android.os.SystemClock
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.ProcessLifecycleOwner
import com.vfxt.wallet.data.local.AppPreferences
import com.vfxt.wallet.data.local.AutoLock
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Tracks whether the UI must show the lock screen.
 *
 * The app starts locked whenever a PIN exists, and re-locks after it has been in the background
 * longer than the user's auto-lock setting. Uses the monotonic clock so changing the device time
 * cannot extend an unlocked session.
 */
@Singleton
class AppLockManager @Inject constructor(
    private val pinManager: PinManager,
    preferences: AppPreferences,
) : DefaultLifecycleObserver {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val autoLock = preferences.autoLock.stateIn(scope, SharingStarted.Eagerly, AutoLock.OneMinute)

    private val _locked = MutableStateFlow(true)
    val locked: StateFlow<Boolean> = _locked.asStateFlow()

    private var backgroundedAt: Long? = null

    fun start() {
        ProcessLifecycleOwner.get().lifecycle.addObserver(this)
    }

    fun unlock() {
        _locked.value = false
    }

    fun lock() {
        if (pinManager.isPinSet.value == true) _locked.value = true
    }

    override fun onStop(owner: LifecycleOwner) {
        backgroundedAt = SystemClock.elapsedRealtime()
    }

    override fun onStart(owner: LifecycleOwner) {
        val since = backgroundedAt ?: return
        backgroundedAt = null
        if (SystemClock.elapsedRealtime() - since >= autoLock.value.millis) lock()
    }
}
