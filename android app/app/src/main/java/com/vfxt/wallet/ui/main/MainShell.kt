package com.vfxt.wallet.ui.main

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Snackbar
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import androidx.navigation.NavDestination.Companion.hasRoute
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.vfxt.wallet.core.designsystem.theme.ThemeMode
import com.vfxt.wallet.core.designsystem.theme.VfxtTheme
import com.vfxt.wallet.navigation.MainTab
import com.vfxt.wallet.navigation.TabRoute
import com.vfxt.wallet.ui.assets.AssetsScreen
import com.vfxt.wallet.ui.home.HomeScreen
import com.vfxt.wallet.ui.mining.MiningScreen
import com.vfxt.wallet.ui.profile.ProfileScreen
import com.vfxt.wallet.ui.trading.TradingScreen
import kotlinx.coroutines.launch

/** Bottom-navigation shell hosting the five main tabs. */
@Composable
fun MainShell(
    themeMode: ThemeMode,
    onThemeModeChange: (ThemeMode) -> Unit,
    onCreateWallet: () -> Unit,
    onImportWallet: () -> Unit,
    onManageWallets: () -> Unit,
    onSecurity: () -> Unit,
) {
    val colors = VfxtTheme.colors
    val navController = rememberNavController()
    val snackbarHostState = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    val notify: (String) -> Unit = { message ->
        scope.launch {
            snackbarHostState.currentSnackbarData?.dismiss()
            snackbarHostState.showSnackbar(message)
        }
    }

    Scaffold(
        containerColor = colors.background,
        bottomBar = { VfxtBottomBar(navController) },
        snackbarHost = {
            SnackbarHost(snackbarHostState) { data ->
                Snackbar(
                    snackbarData = data,
                    shape = RoundedCornerShape(14.dp),
                    containerColor = colors.cardRaised,
                    contentColor = colors.textPrimary,
                )
            }
        },
    ) { padding ->
        NavHost(
            navController = navController,
            startDestination = TabRoute.Home,
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            enterTransition = { fadeIn(tween(220)) },
            exitTransition = { fadeOut(tween(160)) },
        ) {
            composable<TabRoute.Home> {
                HomeScreen(
                    onCreateWallet = onCreateWallet,
                    onImportWallet = onImportWallet,
                    onManageWallets = onManageWallets,
                    onNotify = notify,
                )
            }
            composable<TabRoute.Mining> { MiningScreen(onNotify = notify) }
            composable<TabRoute.Trade> { TradingScreen() }
            composable<TabRoute.Assets> { AssetsScreen(onNotify = notify) }
            composable<TabRoute.Profile> {
                ProfileScreen(
                    themeMode = themeMode,
                    onThemeModeChange = onThemeModeChange,
                    onCreateWallet = onCreateWallet,
                    onImportWallet = onImportWallet,
                    onManageWallets = onManageWallets,
                    onSecurity = onSecurity,
                    onNotify = notify,
                )
            }
        }
    }
}

@Composable
private fun VfxtBottomBar(navController: NavHostController) {
    val colors = VfxtTheme.colors
    val backStackEntry by navController.currentBackStackEntryAsState()
    val destination = backStackEntry?.destination

    Column(Modifier.background(colors.surface)) {
        HorizontalDivider(thickness = 1.dp, color = colors.border)
        Row(
            Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .padding(horizontal = 8.dp, vertical = 6.dp)
                .selectableGroup(),
        ) {
            MainTab.entries.forEach { tab ->
                val selected = destination?.hierarchy?.any { it.hasRoute(tab.route::class) } == true
                BottomBarItem(
                    tab = tab,
                    selected = selected,
                    onClick = {
                        navController.navigate(tab.route) {
                            // Standard tab behaviour: one copy per tab, state saved across switches.
                            popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                            launchSingleTop = true
                            restoreState = true
                        }
                    },
                    modifier = Modifier.weight(1f),
                )
            }
        }
    }
}

@Composable
private fun BottomBarItem(
    tab: MainTab,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = VfxtTheme.colors
    val tint by animateColorAsState(if (selected) colors.primary else colors.textMuted, label = "tabTint")
    val indicatorWidth by animateDpAsState(if (selected) 48.dp else 0.dp, label = "tabIndicator")
    Column(
        modifier
            .clip(RoundedCornerShape(14.dp))
            .selectable(selected = selected, role = Role.Tab, onClick = onClick)
            .padding(vertical = 6.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(contentAlignment = Alignment.Center) {
            Box(
                Modifier
                    .width(indicatorWidth)
                    .height(30.dp)
                    .clip(RoundedCornerShape(50))
                    .background(colors.primary.copy(alpha = 0.14f)),
            )
            Icon(
                if (selected) tab.selectedIcon else tab.unselectedIcon,
                contentDescription = null,
                tint = tint,
                modifier = Modifier.size(22.dp),
            )
        }
        Spacer(Modifier.height(4.dp))
        Text(tab.label, style = MaterialTheme.typography.labelMedium, color = tint)
    }
}
