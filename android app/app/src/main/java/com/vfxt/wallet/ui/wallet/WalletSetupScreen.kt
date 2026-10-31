package com.vfxt.wallet.ui.wallet

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
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.vfxt.wallet.core.designsystem.components.IconTile
import com.vfxt.wallet.core.designsystem.components.StatusPill
import com.vfxt.wallet.core.designsystem.components.VfxtCard
import com.vfxt.wallet.core.designsystem.components.VfxtLogoMark
import com.vfxt.wallet.core.designsystem.components.VfxtTextButton
import com.vfxt.wallet.core.designsystem.theme.Spacing
import com.vfxt.wallet.core.designsystem.theme.VfxtTheme

/** Choose between creating a new wallet and importing an existing one. */
@Composable
fun WalletSetupScreen(
    onCreateWallet: () -> Unit,
    onImportWallet: () -> Unit,
    onExplorePreview: (() -> Unit)?,
) {
    val colors = VfxtTheme.colors
    Column(
        Modifier
            .fillMaxSize()
            .background(colors.background)
            .safeDrawingPadding()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = Spacing.screen),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Spacer(Modifier.height(Spacing.huge))
        Box(
            Modifier
                .size(96.dp)
                .background(
                    androidx.compose.ui.graphics.Brush.radialGradient(
                        listOf(colors.primary.copy(alpha = 0.35f), Color.Transparent),
                    ),
                ),
            contentAlignment = Alignment.Center,
        ) { VfxtLogoMark(size = 64.dp) }
        Spacer(Modifier.height(Spacing.xl))
        Text(
            "Set up your wallet",
            style = MaterialTheme.typography.headlineMedium,
            color = colors.textPrimary,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(Spacing.sm))
        Text(
            "Create a brand-new self-custody wallet or bring the one you already use.",
            style = MaterialTheme.typography.bodyLarge,
            color = colors.textSecondary,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(Spacing.xxxl))

        SetupOptionCard(
            icon = Icons.Filled.Add,
            tint = colors.primary,
            title = "Create a new wallet",
            body = "Generate a new recovery phrase and EVM address on this device.",
            onClick = onCreateWallet,
        )
        Spacer(Modifier.height(Spacing.md))
        SetupOptionCard(
            icon = Icons.Filled.Download,
            tint = colors.accent,
            title = "Import existing wallet",
            body = "Use a recovery phrase or private key from MetaMask, Trust Wallet or any EVM wallet.",
            onClick = onImportWallet,
        )

        Spacer(Modifier.height(Spacing.xxl))
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(Icons.Outlined.Lock, null, tint = colors.success, modifier = Modifier.size(14.dp))
            Spacer(Modifier.width(6.dp))
            Text(
                "Keys are encrypted on-device and never uploaded",
                style = MaterialTheme.typography.bodySmall,
                color = colors.textSecondary,
            )
        }

        if (onExplorePreview != null) {
            Spacer(Modifier.height(Spacing.xxl))
            StatusPill("Debug build only")
            VfxtTextButton("Explore the app without a wallet", onExplorePreview)
        }
        Spacer(Modifier.height(Spacing.xxl))
    }
}

@Composable
private fun SetupOptionCard(
    icon: ImageVector,
    tint: Color,
    title: String,
    body: String,
    onClick: () -> Unit,
) {
    val colors = VfxtTheme.colors
    VfxtCard(Modifier.fillMaxWidth(), onClick = onClick, contentPadding = androidx.compose.foundation.layout.PaddingValues(Spacing.lg)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconTile(icon, tint, size = 48.dp)
            Spacer(Modifier.width(Spacing.lg))
            Column(Modifier.weight(1f)) {
                Text(title, style = MaterialTheme.typography.titleMedium, color = colors.textPrimary)
                Spacer(Modifier.height(2.dp))
                Text(body, style = MaterialTheme.typography.bodyMedium, color = colors.textSecondary)
            }
            Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, null, tint = colors.textMuted)
        }
    }
}

@Preview
@Composable
private fun WalletSetupPreview() {
    VfxtTheme { WalletSetupScreen({}, {}, {}) }
}
