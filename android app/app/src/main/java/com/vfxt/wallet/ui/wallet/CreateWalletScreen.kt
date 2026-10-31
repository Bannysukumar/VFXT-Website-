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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CloudOff
import androidx.compose.material.icons.outlined.EditNote
import androidx.compose.material.icons.outlined.Key
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.vfxt.wallet.core.designsystem.components.IconTile
import com.vfxt.wallet.core.designsystem.components.VfxtCard
import com.vfxt.wallet.core.designsystem.components.VfxtPrimaryButton
import com.vfxt.wallet.core.designsystem.components.VfxtSegmentedControl
import com.vfxt.wallet.core.designsystem.components.VfxtTopBar
import com.vfxt.wallet.core.designsystem.theme.Spacing
import com.vfxt.wallet.core.designsystem.theme.VfxtTheme

/**
 * Step 1 of wallet creation: choose phrase length and acknowledge backup responsibility.
 * Generation uses web3j's BIP-39 implementation fed by SecureRandom (see WalletKeyService).
 */
@Composable
fun CreateWalletScreen(
    onBack: () -> Unit,
    onPhraseGenerated: () -> Unit,
    viewModel: CreateWalletViewModel = hiltViewModel(),
) {
    val colors = VfxtTheme.colors
    var wordCountIndex by rememberSaveable { mutableIntStateOf(0) }
    var ackLoss by rememberSaveable { mutableStateOf(false) }
    var ackNeverShare by rememberSaveable { mutableStateOf(false) }
    var generating by remember { mutableStateOf(false) }

    Column(
        Modifier
            .fillMaxSize()
            .background(colors.background)
            .safeDrawingPadding(),
    ) {
        VfxtTopBar("Create wallet", onBack)
        Column(
            Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = Spacing.screen),
        ) {
            StepIndicator(current = 0, labels = listOf("Secure", "Phrase", "Verify", "PIN"))
            Spacer(Modifier.height(Spacing.xxl))
            Text("Secure your wallet", style = MaterialTheme.typography.headlineSmall, color = colors.textPrimary)
            Spacer(Modifier.height(Spacing.xs))
            Text(
                "Your recovery phrase is the only way to restore this wallet. Read these before continuing.",
                style = MaterialTheme.typography.bodyMedium,
                color = colors.textSecondary,
            )
            Spacer(Modifier.height(Spacing.xl))

            Text("Recovery phrase length", style = MaterialTheme.typography.titleSmall, color = colors.textPrimary)
            Spacer(Modifier.height(Spacing.sm))
            VfxtSegmentedControl(
                options = listOf("12 words", "24 words"),
                selectedIndex = wordCountIndex,
                onSelect = { wordCountIndex = it },
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(Spacing.xs))
            Text(
                "12 words is the MetaMask default. 24 words adds extra entropy. Both work with any BIP-39 wallet.",
                style = MaterialTheme.typography.bodySmall,
                color = colors.textMuted,
            )
            Spacer(Modifier.height(Spacing.xl))

            VfxtCard(Modifier.fillMaxWidth()) {
                SecurityTip(Icons.Outlined.Key, colors.primary, "It's your master key", "Anyone with the phrase controls your funds.")
                Spacer(Modifier.height(Spacing.lg))
                SecurityTip(Icons.Outlined.CloudOff, colors.accent, "Never uploaded", "VFXT stores it encrypted on this device only. We can't recover it.")
                Spacer(Modifier.height(Spacing.lg))
                SecurityTip(Icons.Outlined.EditNote, colors.success, "Write it down offline", "Paper in a safe place. No screenshots, notes apps or chats.")
            }
            Spacer(Modifier.height(Spacing.xl))

            AcknowledgeRow(
                checked = ackLoss,
                onCheckedChange = { ackLoss = it },
                text = "I understand that if I lose my recovery phrase, I lose access to my funds.",
            )
            AcknowledgeRow(
                checked = ackNeverShare,
                onCheckedChange = { ackNeverShare = it },
                text = "I will never share my recovery phrase with anyone, including VFXT support.",
            )
            Spacer(Modifier.height(Spacing.xl))
        }
        VfxtPrimaryButton(
            text = "Generate recovery phrase",
            onClick = {
                generating = true
                viewModel.generate(if (wordCountIndex == 0) 12 else 24) {
                    generating = false
                    onPhraseGenerated()
                }
            },
            enabled = ackLoss && ackNeverShare,
            loading = generating,
            icon = Icons.Outlined.Lock,
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.screen, vertical = Spacing.lg),
        )
    }
}

@Composable
private fun SecurityTip(icon: ImageVector, tint: Color, title: String, body: String) {
    Row(verticalAlignment = Alignment.Top) {
        IconTile(icon, tint, size = 38.dp)
        Spacer(Modifier.width(Spacing.md))
        Column {
            Text(title, style = MaterialTheme.typography.titleSmall, color = VfxtTheme.colors.textPrimary)
            Text(body, style = MaterialTheme.typography.bodySmall, color = VfxtTheme.colors.textSecondary)
        }
    }
}

@Composable
private fun AcknowledgeRow(checked: Boolean, onCheckedChange: (Boolean) -> Unit, text: String) {
    val colors = VfxtTheme.colors
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .toggleable(value = checked, role = Role.Checkbox, onValueChange = onCheckedChange)
            .padding(vertical = Spacing.sm),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Checkbox(
            checked = checked,
            onCheckedChange = null,
            colors = CheckboxDefaults.colors(
                checkedColor = colors.primary,
                uncheckedColor = colors.border,
                checkmarkColor = colors.onPrimary,
            ),
        )
        Spacer(Modifier.width(Spacing.md))
        Text(text, style = MaterialTheme.typography.bodyMedium, color = colors.textPrimary)
    }
}

/** Numbered progress across the multi-step wallet flow. */
@Composable
fun StepIndicator(current: Int, labels: List<String>, modifier: Modifier = Modifier) {
    val colors = VfxtTheme.colors
    Row(modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(Spacing.sm)) {
        labels.forEachIndexed { index, label ->
            val active = index <= current
            Column(Modifier.weight(1f), horizontalAlignment = Alignment.Start) {
                Box(
                    Modifier
                        .fillMaxWidth()
                        .height(4.dp)
                        .clip(CircleShape)
                        .background(if (active) colors.primary else colors.border),
                )
                Spacer(Modifier.height(6.dp))
                Text(
                    "${index + 1}. $label",
                    style = MaterialTheme.typography.labelMedium,
                    color = if (index == current) colors.textPrimary else colors.textMuted,
                    textAlign = TextAlign.Start,
                )
            }
        }
    }
}

@Preview
@Composable
private fun CreateWalletPreview() {
    VfxtTheme { CreateWalletScreen(onBack = {}, onPhraseGenerated = {}) }
}
