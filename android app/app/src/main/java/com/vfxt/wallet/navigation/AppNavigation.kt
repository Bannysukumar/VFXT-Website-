package com.vfxt.wallet.navigation

import androidx.compose.animation.AnimatedContentTransitionScope.SlideDirection
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.vfxt.wallet.BuildConfig
import com.vfxt.wallet.core.designsystem.theme.ThemeMode
import com.vfxt.wallet.core.designsystem.theme.VfxtTheme
import com.vfxt.wallet.core.security.BiometricAuthenticator
import com.vfxt.wallet.ui.main.AppState
import com.vfxt.wallet.ui.main.MainShell
import com.vfxt.wallet.ui.onboarding.OnboardingScreen
import com.vfxt.wallet.ui.security.BiometricSetupScreen
import com.vfxt.wallet.ui.security.PinSetupScreen
import com.vfxt.wallet.ui.security.SecuritySettingsScreen
import com.vfxt.wallet.ui.splash.SplashScreen
import com.vfxt.wallet.ui.swap.SwapScreen
import com.vfxt.wallet.ui.transfer.ActivityScreen
import com.vfxt.wallet.ui.transfer.AddTokenScreen
import com.vfxt.wallet.ui.transfer.NetworkScreen
import com.vfxt.wallet.ui.transfer.ReceiveScreen
import com.vfxt.wallet.ui.transfer.SendScreen
import com.vfxt.wallet.ui.transfer.TokenDetailsScreen
import com.vfxt.wallet.ui.wallet.CreateWalletScreen
import com.vfxt.wallet.ui.wallet.ImportWalletScreen
import com.vfxt.wallet.ui.wallet.RecoveryPhraseScreen
import com.vfxt.wallet.ui.wallet.VerifyPhraseScreen
import com.vfxt.wallet.ui.wallet.WalletAddedNext
import com.vfxt.wallet.ui.wallet.WalletManagementScreen
import com.vfxt.wallet.ui.wallet.WalletSetupScreen

private const val TRANSITION_MS = 320

@Composable
fun AppNavigation(
    appState: AppState?,
    onThemeModeChange: (ThemeMode) -> Unit,
    onOnboardingFinished: () -> Unit,
    navController: NavHostController = rememberNavController(),
) {
    val context = LocalContext.current

    // If the last wallet is removed, leave the wallet-only area and go back to setup.
    var hadWallet by remember { mutableStateOf<Boolean?>(null) }
    LaunchedEffect(appState?.ready, appState?.hasWallet) {
        if (appState?.ready != true) return@LaunchedEffect
        if (hadWallet == true && !appState.hasWallet) navController.resetTo(RootRoute.WalletSetup)
        hadWallet = appState.hasWallet
    }

    val onWalletAdded: (WalletAddedNext) -> Unit = { next ->
        when (next) {
            WalletAddedNext.PinSetup -> navController.resetTo(RootRoute.PinSetup)
            WalletAddedNext.Home -> navController.resetTo(RootRoute.Main)
        }
    }

    NavHost(
        navController = navController,
        startDestination = RootRoute.Splash,
        modifier = Modifier.fillMaxSize().background(VfxtTheme.colors.background),
        enterTransition = { slideIntoContainer(SlideDirection.Start, tween(TRANSITION_MS)) + fadeIn(tween(TRANSITION_MS)) },
        exitTransition = { fadeOut(tween(TRANSITION_MS / 2)) },
        popEnterTransition = { fadeIn(tween(TRANSITION_MS)) },
        popExitTransition = { slideOutOfContainer(SlideDirection.End, tween(TRANSITION_MS)) + fadeOut(tween(TRANSITION_MS)) },
    ) {
        composable<RootRoute.Splash>(exitTransition = { fadeOut(tween(450)) }) {
            SplashScreen(
                isReady = appState?.ready == true,
                onFinished = {
                    val state = appState
                    navController.resetTo(
                        when {
                            state?.hasWallet == true -> RootRoute.Main
                            state?.onboardingComplete == true -> RootRoute.WalletSetup
                            else -> RootRoute.Onboarding
                        },
                    )
                },
            )
        }
        composable<RootRoute.Onboarding>(enterTransition = { fadeIn(tween(450)) }) {
            OnboardingScreen(
                onCreateWallet = {
                    onOnboardingFinished()
                    navController.leaveOnboardingTo(RootRoute.CreateWallet)
                },
                onImportWallet = {
                    onOnboardingFinished()
                    navController.leaveOnboardingTo(RootRoute.ImportWallet)
                },
                onSkip = {
                    onOnboardingFinished()
                    navController.resetTo(RootRoute.WalletSetup)
                },
            )
        }
        composable<RootRoute.WalletSetup>(enterTransition = { fadeIn(tween(450)) }) {
            WalletSetupScreen(
                onCreateWallet = { navController.navigate(RootRoute.CreateWallet) },
                onImportWallet = { navController.navigate(RootRoute.ImportWallet) },
                // Developer preview entry into the app shell; not present in release builds.
                onExplorePreview = if (BuildConfig.DEBUG) {
                    { navController.navigate(RootRoute.Main) }
                } else {
                    null
                },
            )
        }
        composable<RootRoute.CreateWallet> {
            CreateWalletScreen(
                onBack = { navController.popBackStack() },
                onPhraseGenerated = { navController.navigate(RootRoute.RecoveryPhrase) },
            )
        }
        composable<RootRoute.RecoveryPhrase> {
            RecoveryPhraseScreen(
                onBack = { navController.popBackStack() },
                onContinue = { navController.navigate(RootRoute.VerifyPhrase) },
            )
        }
        composable<RootRoute.VerifyPhrase> {
            VerifyPhraseScreen(
                onBack = { navController.popBackStack() },
                onRestart = { navController.popBackStack(RootRoute.CreateWallet, inclusive = false) },
                onWalletAdded = onWalletAdded,
            )
        }
        composable<RootRoute.ImportWallet> {
            ImportWalletScreen(
                onBack = { navController.popBackStack() },
                onWalletAdded = onWalletAdded,
            )
        }
        composable<RootRoute.PinSetup> {
            PinSetupScreen(
                onBack = null,
                onDone = {
                    navController.resetTo(
                        if (BiometricAuthenticator.isAvailable(context)) RootRoute.BiometricSetup else RootRoute.Main,
                    )
                },
            )
        }
        composable<RootRoute.BiometricSetup> {
            BiometricSetupScreen(onDone = { navController.resetTo(RootRoute.Main) })
        }
        composable<RootRoute.Main>(enterTransition = { fadeIn(tween(450)) }) {
            MainShell(
                themeMode = appState?.themeMode ?: ThemeMode.Dark,
                onThemeModeChange = onThemeModeChange,
                onCreateWallet = { navController.navigate(RootRoute.CreateWallet) },
                onImportWallet = { navController.navigate(RootRoute.ImportWallet) },
                onManageWallets = { navController.navigate(RootRoute.WalletManagement) },
                onSecurity = { navController.navigate(RootRoute.SecuritySettings) },
                onSend = { token, recipient -> navController.navigate(RootRoute.Send(token, recipient)) },
                onReceive = { navController.navigate(RootRoute.Receive) },
                onSwap = { navController.navigate(RootRoute.Swap()) },
                onActivity = { navController.navigate(RootRoute.Activity) },
                onTokenDetails = { key -> navController.navigate(RootRoute.TokenDetails(key)) },
                onAddToken = { navController.navigate(RootRoute.AddToken) },
                onNetwork = { navController.navigate(RootRoute.NetworkSelection) },
                onNotifications = { navController.navigate(RootRoute.Notifications) },
                onSupport = { navController.navigate(RootRoute.Support) },
                onPrivacy = { navController.navigate(RootRoute.PrivacyPolicy) },
                onTerms = { navController.navigate(RootRoute.Terms) },
                onWalletConnect = { navController.navigate(RootRoute.WalletConnect) },
                onCurrency = { navController.navigate(RootRoute.Currency) },
                onSessions = { navController.navigate(RootRoute.Sessions) },
            )
        }
        composable<RootRoute.Currency> {
            com.vfxt.wallet.ui.profile.CurrencyScreen(onBack = { navController.popBackStack() })
        }
        composable<RootRoute.Sessions> {
            com.vfxt.wallet.ui.profile.SessionsScreen(onBack = { navController.popBackStack() })
        }
        composable<RootRoute.Send> {
            SendScreen(
                onBack = { navController.popBackStack() },
                onDone = { navController.popBackStack(RootRoute.Main, inclusive = false) },
            )
        }
        composable<RootRoute.Receive> { ReceiveScreen(onBack = { navController.popBackStack() }) }
        composable<RootRoute.Swap> {
            SwapScreen(
                onBack = { navController.popBackStack() },
                onActivity = {
                    navController.navigate(RootRoute.Activity) { popUpTo(RootRoute.Main) }
                },
            )
        }
        composable<RootRoute.Activity> { ActivityScreen(onBack = { navController.popBackStack() }) }
        composable<RootRoute.TokenDetails> {
            TokenDetailsScreen(
                onBack = { navController.popBackStack() },
                onSend = { key -> navController.navigate(RootRoute.Send(tokenKey = key)) },
                onReceive = { navController.navigate(RootRoute.Receive) },
                // VFXT pairs are routed to the VFXT swap contract inside the main Swap screen.
                onSwap = { key -> navController.navigate(RootRoute.Swap(fromTokenKey = key)) },
            )
        }
        composable<RootRoute.VfxtDesk> {
            com.vfxt.wallet.ui.swap.VfxtDeskScreen(
                onBack = { navController.popBackStack() },
                onActivity = { navController.navigate(RootRoute.Activity) { popUpTo(RootRoute.Main) } },
            )
        }
        composable<RootRoute.AddToken> { AddTokenScreen(onBack = { navController.popBackStack() }) }
        composable<RootRoute.NetworkSelection> { NetworkScreen(onBack = { navController.popBackStack() }) }
        composable<RootRoute.WalletManagement> {
            WalletManagementScreen(
                onBack = { navController.popBackStack() },
                onCreateWallet = { navController.navigate(RootRoute.CreateWallet) },
                onImportWallet = { navController.navigate(RootRoute.ImportWallet) },
            )
        }
        composable<RootRoute.SecuritySettings> {
            SecuritySettingsScreen(
                onBack = { navController.popBackStack() },
                onChangePin = { navController.navigate(RootRoute.ChangePin) },
            )
        }
        composable<RootRoute.ChangePin> {
            PinSetupScreen(
                title = "Choose a new PIN",
                onBack = { navController.popBackStack() },
                onDone = { navController.popBackStack() },
            )
        }
        composable<RootRoute.Notifications> {
            com.vfxt.wallet.ui.support.NotificationsScreen(onBack = { navController.popBackStack() })
        }
        composable<RootRoute.Support> {
            com.vfxt.wallet.ui.support.SupportScreen(onBack = { navController.popBackStack() })
        }
        composable<RootRoute.PrivacyPolicy> {
            com.vfxt.wallet.ui.support.LegalScreen(
                title = "Privacy policy",
                body = "VFXT Wallet is a self-custody application. Recovery phrases and private keys are encrypted on your device with the Android Keystore and are never uploaded to VFXT servers. Mining rewards and claims are processed by authenticated backend services. For questions contact support@virtualfxtrades.com.",
                onBack = { navController.popBackStack() },
            )
        }
        composable<RootRoute.Terms> {
            com.vfxt.wallet.ui.support.LegalScreen(
                title = "Terms and conditions",
                body = "By using VFXT Wallet you acknowledge that you control your own keys, that blockchain transactions are irreversible, that mining rewards are subject to server-side rules and payout policy, and that the Trade tab is a demo preview that does not execute real trades or move wallet funds.",
                onBack = { navController.popBackStack() },
            )
        }
        composable<RootRoute.WalletConnect> {
            com.vfxt.wallet.ui.walletconnect.WalletConnectScreen(
                onBack = { navController.popBackStack() },
            )
        }
    }
}

/** Navigates to [destination] and clears the whole back stack beneath it. */
private fun NavHostController.resetTo(destination: RootRoute) {
    navigate(destination) {
        popUpTo(graph.id) { inclusive = true }
        launchSingleTop = true
    }
}

/**
 * Replaces onboarding with WalletSetup and pushes [destination] on top, so both the system Back
 * gesture and the top-bar arrow return to the setup chooser instead of closing the app.
 */
private fun NavHostController.leaveOnboardingTo(destination: RootRoute) {
    navigate(RootRoute.WalletSetup) { popUpTo(RootRoute.Onboarding) { inclusive = true } }
    navigate(destination)
}
