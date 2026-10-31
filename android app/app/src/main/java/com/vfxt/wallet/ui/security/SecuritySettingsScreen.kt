package com.vfxt.wallet.ui.security

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.Alignment
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Backup
import androidx.compose.material.icons.outlined.Fingerprint
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.LockClock
import androidx.compose.material.icons.outlined.Pin
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RadioButton
import androidx.compose.material3.RadioButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.vfxt.wallet.core.designsystem.components.RowDivider
import com.vfxt.wallet.core.designsystem.components.SettingsGroup
import com.vfxt.wallet.core.designsystem.components.SettingsRow
import com.vfxt.wallet.core.designsystem.components.SettingsSwitchRow
import com.vfxt.wallet.core.designsystem.components.VfxtBottomSheet
import com.vfxt.wallet.core.designsystem.components.VfxtTopBar
import com.vfxt.wallet.core.designsystem.theme.Spacing
import com.vfxt.wallet.core.designsystem.theme.VfxtTheme
import com.vfxt.wallet.core.security.BiometricAuthenticator
import com.vfxt.wallet.data.local.AutoLock

@Composable
fun SecuritySettingsScreen(
    onBack: () -> Unit,
    onChangePin: () -> Unit,
    viewModel: SecuritySettingsViewModel = hiltViewModel(),
) {
    val context = LocalContext.current
    val colors = VfxtTheme.colors
    val state by viewModel.state.collectAsStateWithLifecycle()
    val biometricAvailable = remember { BiometricAuthenticator.isAvailable(context) }
    var authForPin by remember { mutableStateOf(false) }
    var pickAutoLock by remember { mutableStateOf(false) }

    Column(
        Modifier
            .fillMaxSize()
            .background(colors.background)
            .safeDrawingPadding(),
    ) {
        VfxtTopBar("Security", onBack)
        Column(
            Modifier
                .verticalScroll(rememberScrollState())
                .padding(horizontal = Spacing.screen, vertical = Spacing.sm),
            verticalArrangement = Arrangement.spacedBy(Spacing.xl),
        ) {
            SettingsGroup("Unlock") {
                SettingsRow(Icons.Outlined.Pin, "Change PIN", onClick = { authForPin = true })
                RowDivider()
                SettingsSwitchRow(
                    Icons.Outlined.Fingerprint,
                    "Biometric unlock",
                    subtitle = if (biometricAvailable) "Fingerprint or face, PIN as fallback" else "No strong biometrics enrolled on this device",
                    checked = state.biometricEnabled && biometricAvailable,
                    enabled = biometricAvailable,
                    onCheckedChange = { enable ->
                        if (enable) {
                            BiometricAuthenticator.authenticate(context, title = "Enable biometric unlock", onSuccess = { viewModel.setBiometric(true) })
                        } else {
                            viewModel.setBiometric(false)
                        }
                    },
                )
                RowDivider()
                SettingsRow(Icons.Outlined.LockClock, "Auto-lock", value = state.autoLock.label, onClick = { pickAutoLock = true })
                RowDivider()
                SettingsRow(Icons.Outlined.Lock, "Lock now", onClick = viewModel::lockNow)
            }
            SettingsGroup("Backup") {
                SettingsRow(
                    Icons.Outlined.Backup,
                    "Recovery phrase backup",
                    subtitle = if (state.allBackedUp) "All wallets verified" else "Some wallets aren't backed up",
                    tint = if (state.allBackedUp) colors.success else colors.warning,
                )
            }
            Text(
                "Your keys are encrypted with a hardware-backed Android Keystore key and never leave this device.",
                style = MaterialTheme.typography.bodySmall,
                color = colors.textMuted,
            )
            Spacer(Modifier.height(Spacing.lg))
        }
    }

    if (authForPin) {
        AuthenticateSheet(
            reason = "Enter your current PIN",
            onAuthenticated = { authForPin = false; onChangePin() },
            onDismiss = { authForPin = false },
        )
    }

    if (pickAutoLock) {
        VfxtBottomSheet(onDismiss = { pickAutoLock = false }) {
            Text("Auto-lock", style = MaterialTheme.typography.headlineSmall, color = colors.textPrimary)
            Text("Lock the app after it's been in the background for:", style = MaterialTheme.typography.bodyMedium, color = colors.textSecondary)
            Spacer(Modifier.height(Spacing.md))
            AutoLock.entries.forEach { option ->
                Row(
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .selectable(selected = option == state.autoLock, role = Role.RadioButton) {
                            viewModel.setAutoLock(option)
                            pickAutoLock = false
                        }
                        .padding(vertical = Spacing.sm),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    RadioButton(
                        selected = option == state.autoLock,
                        onClick = null,
                        colors = RadioButtonDefaults.colors(selectedColor = colors.primary, unselectedColor = colors.border),
                    )
                    Spacer(Modifier.width(Spacing.md))
                    Text(option.label, style = MaterialTheme.typography.bodyLarge, color = colors.textPrimary, modifier = Modifier.weight(1f))
                }
            }
        }
    }
}
