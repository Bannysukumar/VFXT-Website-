package com.vfxt.wallet.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountBalanceWallet
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.CandlestickChart
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.outlined.AccountBalanceWallet
import androidx.compose.material.icons.outlined.Bolt
import androidx.compose.material.icons.outlined.CandlestickChart
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Person
import androidx.compose.ui.graphics.vector.ImageVector
import kotlinx.serialization.Serializable

/** Root-level destinations (outside the bottom-navigation shell). */
sealed interface RootRoute {
    @Serializable data object Splash : RootRoute
    @Serializable data object Onboarding : RootRoute
    @Serializable data object WalletSetup : RootRoute
    @Serializable data object CreateWallet : RootRoute
    @Serializable data object ImportWallet : RootRoute
    @Serializable data object RecoveryPhrase : RootRoute
    @Serializable data object VerifyPhrase : RootRoute
    @Serializable data object PinSetup : RootRoute
    @Serializable data object BiometricSetup : RootRoute
    @Serializable data object Main : RootRoute
    @Serializable data object WalletManagement : RootRoute
    @Serializable data object SecuritySettings : RootRoute
    @Serializable data object ChangePin : RootRoute
    @Serializable data class Send(
        val tokenKey: String? = null,
        val recipient: String? = null,
        /** Human token amount from a website / deep-link payment request. */
        val amount: String? = null,
    ) : RootRoute
    @Serializable data object Receive : RootRoute
    @Serializable data class Swap(val fromTokenKey: String? = null) : RootRoute
    @Serializable data object Activity : RootRoute
    @Serializable data class TokenDetails(val tokenKey: String) : RootRoute
    @Serializable data object AddToken : RootRoute
    @Serializable data object NetworkSelection : RootRoute
    @Serializable data object Notifications : RootRoute
    @Serializable data object Support : RootRoute
    @Serializable data object PrivacyPolicy : RootRoute
    @Serializable data object Terms : RootRoute
    @Serializable data object WalletConnect : RootRoute
    @Serializable data object Currency : RootRoute
    @Serializable data object Sessions : RootRoute
    @Serializable data object VfxtDesk : RootRoute
}

/** Destinations hosted inside the bottom-navigation shell. */
sealed interface TabRoute {
    @Serializable data object Home : TabRoute
    @Serializable data object Mining : TabRoute
    @Serializable data object Trade : TabRoute
    @Serializable data object Assets : TabRoute
    @Serializable data object Profile : TabRoute
}

enum class MainTab(
    val route: TabRoute,
    val label: String,
    val selectedIcon: ImageVector,
    val unselectedIcon: ImageVector,
) {
    Home(TabRoute.Home, "Home", Icons.Filled.Home, Icons.Outlined.Home),
    Mining(TabRoute.Mining, "Mining", Icons.Filled.Bolt, Icons.Outlined.Bolt),
    Trade(TabRoute.Trade, "Trade", Icons.Filled.CandlestickChart, Icons.Outlined.CandlestickChart),
    Assets(TabRoute.Assets, "Assets", Icons.Filled.AccountBalanceWallet, Icons.Outlined.AccountBalanceWallet),
    Profile(TabRoute.Profile, "Profile", Icons.Filled.Person, Icons.Outlined.Person),
}
