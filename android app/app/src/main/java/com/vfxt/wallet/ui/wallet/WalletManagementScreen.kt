package com.vfxt.wallet.ui.wallet

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.DeleteOutline
import androidx.compose.material.icons.outlined.Download
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material.icons.outlined.Key
import androidx.compose.material.icons.outlined.Visibility
import androidx.compose.material.icons.outlined.VisibilityOff
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.vfxt.wallet.blockchain.wallet.WalletKeyService
import com.vfxt.wallet.core.common.Formatters
import com.vfxt.wallet.core.designsystem.components.PillTone
import com.vfxt.wallet.core.designsystem.components.RowDivider
import com.vfxt.wallet.core.designsystem.components.SettingsRow
import com.vfxt.wallet.core.designsystem.components.StatusPill
import com.vfxt.wallet.core.designsystem.components.VfxtBottomSheet
import com.vfxt.wallet.core.designsystem.components.VfxtPrimaryButton
import com.vfxt.wallet.core.designsystem.components.VfxtSecondaryButton
import com.vfxt.wallet.core.designsystem.components.VfxtTextButton
import com.vfxt.wallet.core.designsystem.components.VfxtTopBar
import com.vfxt.wallet.core.designsystem.theme.Spacing
import com.vfxt.wallet.core.designsystem.theme.VfxtTheme
import com.vfxt.wallet.core.security.SecureScreen
import com.vfxt.wallet.data.local.WalletSource
import com.vfxt.wallet.data.local.WalletSummary
import com.vfxt.wallet.ui.security.AuthenticateSheet

/** Pending sensitive action awaiting PIN/biometric confirmation. */
private sealed interface PendingAuth {
    data class Reveal(val wallet: WalletSummary, val kind: SecretKind) : PendingAuth
    data class Remove(val wallet: WalletSummary) : PendingAuth
}

@Composable
fun WalletManagementScreen(
    onBack: () -> Unit,
    onCreateWallet: () -> Unit,
    onImportWallet: () -> Unit,
    viewModel: WalletManagementViewModel = hiltViewModel(),
) {
    val colors = VfxtTheme.colors
    val state by viewModel.state.collectAsStateWithLifecycle()
    val revealed by viewModel.revealed.collectAsStateWithLifecycle()

    var actionsFor by remember { mutableStateOf<WalletSummary?>(null) }
    var renaming by remember { mutableStateOf<WalletSummary?>(null) }
    var confirmRemove by remember { mutableStateOf<WalletSummary?>(null) }
    var pendingAuth by remember { mutableStateOf<PendingAuth?>(null) }

    Column(
        Modifier
            .fillMaxSize()
            .background(colors.background)
            .safeDrawingPadding(),
    ) {
        VfxtTopBar("Wallets", onBack)
        LazyColumn(
            Modifier.weight(1f),
            contentPadding = PaddingValues(horizontal = Spacing.screen, vertical = Spacing.sm),
            verticalArrangement = Arrangement.spacedBy(Spacing.md),
        ) {
            items(state.wallets, key = { it.id }) { wallet ->
                WalletCard(
                    wallet = wallet,
                    active = wallet.id == state.activeId,
                    onSelect = { viewModel.select(wallet.id) },
                    onMore = { actionsFor = wallet },
                )
            }
        }
        Column(Modifier.padding(horizontal = Spacing.screen, vertical = Spacing.lg), verticalArrangement = Arrangement.spacedBy(Spacing.sm)) {
            VfxtPrimaryButton("Create new wallet", onCreateWallet, Modifier.fillMaxWidth(), icon = Icons.Outlined.Add)
            VfxtSecondaryButton("Import wallet", onImportWallet, Modifier.fillMaxWidth(), icon = Icons.Outlined.Download)
        }
    }

    actionsFor?.let { wallet ->
        VfxtBottomSheet(onDismiss = { actionsFor = null }) {
            Text(wallet.name, style = MaterialTheme.typography.titleLarge, color = colors.textPrimary)
            Text(Formatters.shortAddress(wallet.address), style = MaterialTheme.typography.bodySmall, color = colors.textSecondary)
            Spacer(Modifier.height(Spacing.lg))
            SettingsRow(Icons.Outlined.Edit, "Rename", onClick = { actionsFor = null; renaming = wallet })
            if (wallet.hasRecoveryPhrase) {
                RowDivider()
                SettingsRow(
                    Icons.Outlined.Visibility,
                    "Show recovery phrase",
                    subtitle = "Requires your PIN",
                    onClick = { actionsFor = null; pendingAuth = PendingAuth.Reveal(wallet, SecretKind.RecoveryPhrase) },
                )
            }
            RowDivider()
            SettingsRow(
                Icons.Outlined.Key,
                "Show private key",
                subtitle = "Requires your PIN",
                onClick = { actionsFor = null; pendingAuth = PendingAuth.Reveal(wallet, SecretKind.PrivateKey) },
            )
            RowDivider()
            SettingsRow(
                Icons.Outlined.DeleteOutline,
                "Remove wallet",
                tint = colors.error,
                onClick = { actionsFor = null; confirmRemove = wallet },
            )
        }
    }

    renaming?.let { wallet ->
        RenameDialog(wallet.name, onDismiss = { renaming = null }, onConfirm = { viewModel.rename(wallet.id, it); renaming = null })
    }

    confirmRemove?.let { wallet ->
        AlertDialog(
            onDismissRequest = { confirmRemove = null },
            containerColor = colors.surface,
            title = { Text("Remove \"${wallet.name}\"?", color = colors.textPrimary) },
            text = {
                Text(
                    "This deletes the wallet from this device only. Funds stay on the blockchain, but you will need the " +
                        (if (wallet.hasRecoveryPhrase) "recovery phrase" else "private key") + " to restore it. Make sure you have it backed up.",
                    color = colors.textSecondary,
                )
            },
            confirmButton = {
                VfxtTextButton("Remove", { confirmRemove = null; pendingAuth = PendingAuth.Remove(wallet) }, color = colors.error)
            },
            dismissButton = { VfxtTextButton("Cancel", { confirmRemove = null }, color = colors.textSecondary) },
        )
    }

    pendingAuth?.let { action ->
        AuthenticateSheet(
            reason = when (action) {
                is PendingAuth.Reveal -> if (action.kind == SecretKind.RecoveryPhrase) "Enter your PIN to view the recovery phrase" else "Enter your PIN to view the private key"
                is PendingAuth.Remove -> "Enter your PIN to remove this wallet"
            },
            onAuthenticated = {
                pendingAuth = null
                when (action) {
                    is PendingAuth.Reveal -> viewModel.reveal(action.wallet, action.kind)
                    is PendingAuth.Remove -> viewModel.remove(action.wallet.id)
                }
            },
            onDismiss = { pendingAuth = null },
        )
    }

    revealed?.let { secret -> RevealSecretSheet(secret, onDismiss = viewModel::hideSecret) }
}

@Composable
private fun WalletCard(wallet: WalletSummary, active: Boolean, onSelect: () -> Unit, onMore: () -> Unit) {
    val colors = VfxtTheme.colors
    val shape = RoundedCornerShape(20.dp)
    Row(
        Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(colors.card)
            .border(if (active) 1.5.dp else 1.dp, if (active) colors.primary else colors.border, shape)
            .clickable(role = Role.RadioButton, onClick = onSelect)
            .padding(Spacing.lg),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier
                .size(44.dp)
                .clip(CircleShape)
                .background(colors.brandGradient),
            contentAlignment = Alignment.Center,
        ) {
            Text(wallet.name.take(1).uppercase(), style = MaterialTheme.typography.titleMedium, color = colors.onPrimary)
        }
        Spacer(Modifier.width(Spacing.md))
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(wallet.name, style = MaterialTheme.typography.titleSmall, color = colors.textPrimary)
                if (active) {
                    Spacer(Modifier.width(6.dp))
                    StatusPill("Active", tone = PillTone.Primary)
                }
            }
            Text(Formatters.shortAddress(wallet.address), style = MaterialTheme.typography.bodySmall, color = colors.textSecondary)
            Text(
                when (wallet.source) {
                    WalletSource.CreatedMnemonic -> "Created · ${WalletKeyService.DERIVATION_PATH_PREFIX}${wallet.accountIndex ?: 0}"
                    WalletSource.ImportedMnemonic -> "Imported phrase · ${WalletKeyService.DERIVATION_PATH_PREFIX}${wallet.accountIndex ?: 0}"
                    WalletSource.ImportedPrivateKey -> "Imported private key"
                },
                style = MaterialTheme.typography.labelMedium,
                color = colors.textMuted,
            )
        }
        IconButton(onClick = onMore) {
            Icon(Icons.Filled.MoreVert, contentDescription = "Wallet options", tint = colors.textSecondary)
        }
    }
}

@Composable
private fun RenameDialog(current: String, onDismiss: () -> Unit, onConfirm: (String) -> Unit) {
    val colors = VfxtTheme.colors
    var name by remember { mutableStateOf(current) }
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = colors.surface,
        title = { Text("Rename wallet", color = colors.textPrimary) },
        text = {
            OutlinedTextField(
                value = name,
                onValueChange = { if (it.length <= 32) name = it },
                singleLine = true,
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = colors.primary,
                    unfocusedBorderColor = colors.border,
                    focusedTextColor = colors.textPrimary,
                    unfocusedTextColor = colors.textPrimary,
                    cursorColor = colors.primary,
                ),
            )
        },
        confirmButton = { VfxtTextButton("Save", { onConfirm(name) }) },
        dismissButton = { VfxtTextButton("Cancel", onDismiss, color = colors.textSecondary) },
    )
}

/** Shows a secret behind screenshot protection. Nothing is copied to the clipboard. */
@Composable
private fun RevealSecretSheet(secret: RevealedSecret, onDismiss: () -> Unit) {
    SecureScreen()
    val colors = VfxtTheme.colors
    var showKey by remember { mutableStateOf(false) }
    VfxtBottomSheet(onDismiss) {
        Text(
            if (secret.kind == SecretKind.RecoveryPhrase) "Recovery phrase" else "Private key",
            style = MaterialTheme.typography.headlineSmall,
            color = colors.textPrimary,
        )
        Text(secret.walletName, style = MaterialTheme.typography.bodyMedium, color = colors.textSecondary)
        Spacer(Modifier.height(Spacing.lg))
        if (secret.kind == SecretKind.RecoveryPhrase) {
            RevealablePhrase(secret.value.split(" "))
        } else {
            Row(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .background(colors.card)
                    .border(1.dp, colors.border, RoundedCornerShape(14.dp))
                    .padding(Spacing.md),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    if (showKey) secret.value else "•".repeat(32),
                    style = MaterialTheme.typography.bodyMedium,
                    color = colors.textPrimary,
                    modifier = Modifier.weight(1f),
                )
                IconButton(onClick = { showKey = !showKey }) {
                    Icon(
                        if (showKey) Icons.Outlined.VisibilityOff else Icons.Outlined.Visibility,
                        contentDescription = if (showKey) "Hide" else "Show",
                        tint = colors.textSecondary,
                    )
                }
            }
        }
        Spacer(Modifier.height(Spacing.lg))
        Text(
            "Anyone with this ${if (secret.kind == SecretKind.RecoveryPhrase) "phrase" else "key"} can take your funds. " +
                "Never enter it on a website or share it with support.",
            style = MaterialTheme.typography.bodySmall,
            color = colors.warning,
        )
        Spacer(Modifier.height(Spacing.lg))
        VfxtPrimaryButton("Done", onDismiss, Modifier.fillMaxWidth())
    }
}
