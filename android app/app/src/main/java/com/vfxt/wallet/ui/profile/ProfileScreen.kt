package com.vfxt.wallet.ui.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.HelpOutline
import androidx.compose.material.icons.outlined.AccountBalanceWallet
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.AttachMoney
import androidx.compose.material.icons.outlined.Backup
import androidx.compose.material.icons.outlined.DarkMode
import androidx.compose.material.icons.outlined.Description
import androidx.compose.material.icons.outlined.Devices
import androidx.compose.material.icons.outlined.Download
import androidx.compose.material.icons.outlined.Fingerprint
import androidx.compose.material.icons.outlined.Hub
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material.icons.outlined.Language
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.LockClock
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.Pin
import androidx.compose.material.icons.outlined.Policy
import androidx.compose.material.icons.outlined.SupportAgent
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.runtime.getValue
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.vfxt.wallet.BuildConfig
import com.vfxt.wallet.core.common.Formatters
import com.vfxt.wallet.blockchain.networks.Networks
import com.vfxt.wallet.core.designsystem.components.RowDivider
import com.vfxt.wallet.core.designsystem.components.ScreenHeader
import com.vfxt.wallet.core.designsystem.components.SettingsGroup
import com.vfxt.wallet.core.designsystem.components.SettingsRow
import com.vfxt.wallet.core.designsystem.components.SettingsSwitchRow
import com.vfxt.wallet.core.designsystem.components.VfxtCard
import com.vfxt.wallet.core.designsystem.theme.Spacing
import com.vfxt.wallet.core.designsystem.theme.ThemeMode
import com.vfxt.wallet.core.designsystem.theme.VfxtTheme

@Composable
fun ProfileScreen(
    themeMode: ThemeMode,
    onThemeModeChange: (ThemeMode) -> Unit,
    onCreateWallet: () -> Unit,
    onImportWallet: () -> Unit,
    onManageWallets: () -> Unit,
    onSecurity: () -> Unit,
    onNotify: (String) -> Unit,
    viewModel: ProfileViewModel = hiltViewModel(),
) {
    val profile by viewModel.state.collectAsStateWithLifecycle()
    val later = { onNotify("Coming in a later update.") }
    val needsWallet = { onNotify("Create or import a wallet first.") }
    val hasWallet = profile.activeAccount != null
    val walletOnly = { action: () -> Unit -> if (hasWallet) action() else needsWallet() }
    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState()),
    ) {
        ScreenHeader("Profile")
        Column(
            Modifier.padding(horizontal = Spacing.screen),
            verticalArrangement = Arrangement.spacedBy(Spacing.xl),
        ) {
            ProfileHeader(profile)

            SettingsGroup("Wallet") {
                SettingsRow(
                    Icons.Outlined.AccountBalanceWallet,
                    "Manage wallets",
                    subtitle = "Rename, switch and remove",
                    value = if (hasWallet) "${profile.walletCount}" else null,
                    onClick = { walletOnly(onManageWallets) },
                )
                RowDivider()
                SettingsRow(Icons.Outlined.Add, "Create new wallet", onClick = onCreateWallet)
                RowDivider()
                SettingsRow(Icons.Outlined.Download, "Import wallet", subtitle = "Recovery phrase or private key", onClick = onImportWallet)
                RowDivider()
                SettingsRow(Icons.Outlined.Backup, "Show recovery phrase", subtitle = "Requires your PIN", onClick = { walletOnly(onManageWallets) })
            }

            SettingsGroup("Security") {
                SettingsRow(Icons.Outlined.Pin, "PIN, biometrics & auto-lock", onClick = { walletOnly(onSecurity) })
                RowDivider()
                SettingsRow(Icons.Outlined.Devices, "Active sessions", subtitle = "Available with account sign-in", onClick = later)
            }

            SettingsGroup("Preferences") {
                SettingsSwitchRow(
                    Icons.Outlined.DarkMode,
                    "Dark mode",
                    checked = themeMode == ThemeMode.Dark,
                    onCheckedChange = { onThemeModeChange(if (it) ThemeMode.Dark else ThemeMode.Light) },
                )
                RowDivider()
                SettingsRow(Icons.Outlined.Language, "Language", value = "English", onClick = later)
                RowDivider()
                SettingsRow(Icons.Outlined.AttachMoney, "Currency", value = "USD", onClick = later)
                RowDivider()
                SettingsRow(Icons.Outlined.Notifications, "Notifications", onClick = later)
                RowDivider()
                SettingsRow(Icons.Outlined.Hub, "Network", value = Networks.BscMainnet.shortName, onClick = later)
            }

            SettingsGroup("Support") {
                SettingsRow(Icons.Outlined.SupportAgent, "Customer support", onClick = later)
                RowDivider()
                SettingsRow(Icons.AutoMirrored.Outlined.HelpOutline, "FAQs", onClick = later)
                RowDivider()
                SettingsRow(Icons.Outlined.Policy, "Privacy policy", onClick = later)
                RowDivider()
                SettingsRow(Icons.Outlined.Description, "Terms and conditions", onClick = later)
                RowDivider()
                SettingsRow(Icons.Outlined.Info, "About VFXT", value = "v${BuildConfig.VERSION_NAME}")
            }

            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(Icons.Outlined.Lock, null, tint = VfxtTheme.colors.textMuted, modifier = Modifier.size(14.dp))
                Spacer(Modifier.width(6.dp))
                Text(
                    "VFXT will never ask for your recovery phrase.",
                    style = MaterialTheme.typography.bodySmall,
                    color = VfxtTheme.colors.textMuted,
                    textAlign = TextAlign.Center,
                )
            }
            Spacer(Modifier.height(Spacing.lg))
        }
    }
}

@Composable
private fun ProfileHeader(profile: ProfileState) {
    val colors = VfxtTheme.colors
    VfxtCard(Modifier.fillMaxWidth()) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier
                    .size(60.dp)
                    .clip(CircleShape)
                    .background(colors.accentGradient),
                contentAlignment = Alignment.Center,
            ) {
                Icon(Icons.Outlined.Person, contentDescription = "Profile picture", tint = colors.onPrimary, modifier = Modifier.size(30.dp))
            }
            Spacer(Modifier.width(Spacing.lg))
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                val account = profile.activeAccount
                Text(account?.name ?: "Guest", style = MaterialTheme.typography.titleLarge, color = colors.textPrimary)
                Text(
                    account?.let { Formatters.shortAddress(it.address) } ?: "No wallet connected",
                    style = MaterialTheme.typography.bodySmall,
                    color = colors.textSecondary,
                )
            }
        }
    }
}

@Preview
@Composable
private fun ProfilePreview() {
    VfxtTheme {
        Box(Modifier.background(VfxtTheme.colors.background)) {
            ProfileHeader(ProfileState())
        }
    }
}
