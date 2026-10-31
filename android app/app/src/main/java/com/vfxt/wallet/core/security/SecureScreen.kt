package com.vfxt.wallet.core.security

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.view.WindowManager
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.ui.platform.LocalContext
import java.util.WeakHashMap

/**
 * Number of composables currently requesting FLAG_SECURE, per Activity.
 *
 * Reference counting is required because during a navigation transition the incoming secure
 * screen is composed *before* the outgoing one is disposed. A plain add/clear would let the
 * outgoing screen's onDispose clear the flag that the incoming screen just set.
 */
private val secureRequests = WeakHashMap<Activity, Int>()

/**
 * Blocks screenshots, screen recording and the recents thumbnail (FLAG_SECURE) while the
 * calling composable is in composition. Use on every screen that shows or accepts a
 * recovery phrase or private key.
 */
@Composable
fun SecureScreen() {
    val context = LocalContext.current
    DisposableEffect(context) {
        val activity = context.findActivity()
        if (activity != null) {
            val count = (secureRequests[activity] ?: 0) + 1
            secureRequests[activity] = count
            if (count == 1) activity.window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        }
        onDispose {
            if (activity != null) {
                val remaining = ((secureRequests[activity] ?: 1) - 1).coerceAtLeast(0)
                if (remaining == 0) {
                    secureRequests.remove(activity)
                    activity.window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
                } else {
                    secureRequests[activity] = remaining
                }
            }
        }
    }
}

private tailrec fun Context.findActivity(): Activity? = when (this) {
    is Activity -> this
    is ContextWrapper -> baseContext.findActivity()
    else -> null
}
