package com.vfxt.wallet

import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.vfxt.wallet.core.designsystem.theme.ThemeMode
import com.vfxt.wallet.core.designsystem.theme.VfxtTheme
import com.vfxt.wallet.navigation.AppNavigation
import com.vfxt.wallet.ui.main.AppViewModel
import com.vfxt.wallet.ui.security.LockScreen
import com.vfxt.wallet.blockchain.walletconnect.WalletConnectSessionManager
import com.vfxt.wallet.ui.walletconnect.WalletConnectPrompts
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

/** FragmentActivity (not ComponentActivity) because BiometricPrompt requires it. */
@AndroidEntryPoint
class MainActivity : FragmentActivity() {

    private val appViewModel: AppViewModel by viewModels()

    @Inject lateinit var walletConnect: WalletConnectSessionManager

    override fun onCreate(savedInstanceState: Bundle?) {
        val splash = installSplashScreen()
        super.onCreate(savedInstanceState)
        // Hold the system splash until we know whether to show onboarding, the lock screen or the app.
        splash.setKeepOnScreenCondition { appViewModel.state.value?.ready != true }
        if (savedInstanceState == null) handleDeepLink(intent)

        setContent {
            val state by appViewModel.state.collectAsStateWithLifecycle()
            val themeMode = state?.themeMode ?: ThemeMode.Dark

            LaunchedEffect(themeMode) {
                val style = if (themeMode == ThemeMode.Dark) {
                    SystemBarStyle.dark(Color.TRANSPARENT)
                } else {
                    SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT)
                }
                enableEdgeToEdge(statusBarStyle = style, navigationBarStyle = style)
            }

            VfxtTheme(themeMode) {
                Box(Modifier.fillMaxSize()) {
                    AppNavigation(
                        appState = state,
                        onThemeModeChange = appViewModel::setThemeMode,
                        onOnboardingFinished = appViewModel::setOnboardingComplete,
                    )
                    // dApp connection and signing prompts wait until the wallet is unlocked.
                    if (state?.ready == true && state?.showLockScreen != true) WalletConnectPrompts()
                    // Drawn above everything, including dialogs' host content.
                    if (state?.showLockScreen == true) LockScreen()
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleDeepLink(intent)
    }

    private fun handleDeepLink(intent: Intent?) {
        val data = intent?.data ?: return
        when {
            data.scheme.equals("wc", ignoreCase = true) -> {
                walletConnect.submitPairingUri(data.toString())
            }
            data.scheme.equals("vfxtwallet", ignoreCase = true) -> {
                val pay = com.vfxt.wallet.navigation.PendingPaymentLink.parse(data)
                if (pay != null) {
                    com.vfxt.wallet.navigation.PendingPaymentLink.offer(pay)
                }
            }
        }
    }
}
