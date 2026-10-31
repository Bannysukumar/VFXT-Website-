package com.vfxt.wallet.core.designsystem.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.RocketLaunch
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.vfxt.wallet.core.designsystem.theme.Spacing
import com.vfxt.wallet.core.designsystem.theme.VfxtTheme

/** Branded modal bottom sheet. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun VfxtBottomSheet(
    onDismiss: () -> Unit,
    content: @Composable () -> Unit,
) {
    val colors = VfxtTheme.colors
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = colors.surface,
        contentColor = colors.textPrimary,
        scrimColor = colors.background.copy(alpha = 0.7f),
    ) {
        Column(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.xxl)
                .padding(bottom = Spacing.xxl)
                .navigationBarsPadding(),
        ) { content() }
    }
}

/** Explains that a visible feature is not available yet. Never implies the action happened. */
@Composable
fun ComingSoonSheet(
    title: String,
    message: String,
    onDismiss: () -> Unit,
    icon: ImageVector = Icons.Outlined.RocketLaunch,
    showDemoNotice: Boolean = false,
) {
    val colors = VfxtTheme.colors
    VfxtBottomSheet(onDismiss) {
        Column(
            Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(Spacing.sm),
        ) {
            IconTile(icon, colors.accent, size = 64.dp)
            Spacer(Modifier.height(Spacing.sm))
            SoonBadge()
            Text(title, style = MaterialTheme.typography.headlineSmall, color = colors.textPrimary, textAlign = TextAlign.Center)
            Text(message, style = MaterialTheme.typography.bodyMedium, color = colors.textSecondary, textAlign = TextAlign.Center)
            if (showDemoNotice) {
                Spacer(Modifier.height(Spacing.xs))
                StatusPill("No orders are placed and no funds move", tone = PillTone.Warning)
            }
            Spacer(Modifier.height(Spacing.md))
            VfxtPrimaryButton("Got it", onDismiss, Modifier.fillMaxWidth())
        }
    }
}
