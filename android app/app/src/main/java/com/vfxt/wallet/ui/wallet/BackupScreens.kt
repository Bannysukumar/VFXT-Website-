package com.vfxt.wallet.ui.wallet

import android.os.Build
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.Visibility
import androidx.compose.material.icons.outlined.WarningAmber
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.vfxt.wallet.core.designsystem.components.EmptyState
import com.vfxt.wallet.core.designsystem.components.VfxtChip
import com.vfxt.wallet.core.designsystem.components.VfxtPrimaryButton
import com.vfxt.wallet.core.designsystem.components.VfxtTopBar
import com.vfxt.wallet.core.designsystem.theme.Spacing
import com.vfxt.wallet.core.designsystem.theme.VfxtTheme
import com.vfxt.wallet.core.security.SecureScreen

/** Numbered two-column grid of recovery words. Shared by backup and "show recovery phrase". */
@Composable
fun RecoveryWordGrid(words: List<String>, modifier: Modifier = Modifier, hidden: Boolean = false) {
    val colors = VfxtTheme.colors
    val half = (words.size + 1) / 2
    Row(
        modifier.then(if (hidden) Modifier.blur(14.dp) else Modifier),
        horizontalArrangement = Arrangement.spacedBy(Spacing.sm),
    ) {
        listOf(0 until half, half until words.size).forEach { range ->
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(Spacing.sm)) {
                range.forEach { i ->
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .background(colors.card)
                            .border(1.dp, colors.border, RoundedCornerShape(12.dp))
                            .padding(horizontal = Spacing.md, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text("${i + 1}", style = MaterialTheme.typography.labelMedium, color = colors.textMuted, modifier = Modifier.width(24.dp))
                        Text(words[i], style = MaterialTheme.typography.titleSmall, color = colors.textPrimary)
                    }
                }
            }
        }
    }
}

/** Displays a phrase behind a tap-to-reveal blur so it isn't exposed the moment the screen opens. */
@Composable
fun RevealablePhrase(words: List<String>, modifier: Modifier = Modifier) {
    val colors = VfxtTheme.colors
    var revealed by remember { mutableStateOf(false) }
    Box(modifier.fillMaxWidth()) {
        RecoveryWordGrid(words, hidden = !revealed)
        if (!revealed) {
            Column(
                Modifier
                    .matchParentSize()
                    .clip(RoundedCornerShape(16.dp))
                    // Modifier.blur only works on API 31+, so cover the words fully on older devices.
                    .background(colors.background.copy(alpha = if (Build.VERSION.SDK_INT >= 31) 0.55f else 0.98f))
                    .clickable(role = Role.Button) { revealed = true },
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                Icon(Icons.Outlined.Visibility, null, tint = colors.textPrimary, modifier = Modifier.size(32.dp))
                Spacer(Modifier.height(Spacing.sm))
                Text("Tap to reveal", style = MaterialTheme.typography.titleMedium, color = colors.textPrimary)
                Text("Make sure no one is watching your screen", style = MaterialTheme.typography.bodySmall, color = colors.textSecondary)
            }
        }
    }
}

@Composable
private fun WarningBanner(text: String) {
    val colors = VfxtTheme.colors
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(colors.warning.copy(alpha = 0.10f))
            .border(1.dp, colors.warning.copy(alpha = 0.35f), RoundedCornerShape(14.dp))
            .padding(Spacing.md),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(Icons.Outlined.WarningAmber, null, tint = colors.warning, modifier = Modifier.size(20.dp))
        Spacer(Modifier.width(Spacing.md))
        Text(text, style = MaterialTheme.typography.bodySmall, color = colors.textPrimary)
    }
}

@Composable
private fun SessionLost(onRestart: () -> Unit) {
    EmptyState(
        icon = Icons.Outlined.WarningAmber,
        title = "Phrase no longer available",
        message = "For your security the recovery phrase is only kept in memory. Please start again; nothing was saved.",
        actionLabel = "Start again",
        onAction = onRestart,
    )
}

/** Step 2: write down the phrase. */
@Composable
fun RecoveryPhraseScreen(
    onBack: () -> Unit,
    onContinue: () -> Unit,
    viewModel: RecoveryPhraseViewModel = hiltViewModel(),
) {
    SecureScreen()
    val words = viewModel.words
    Column(
        Modifier
            .fillMaxSize()
            .background(VfxtTheme.colors.background)
            .safeDrawingPadding(),
    ) {
        VfxtTopBar("Recovery phrase", onBack)
        if (words == null) {
            SessionLost(onBack)
            return@Column
        }
        Column(
            Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = Spacing.screen),
        ) {
            StepIndicator(current = 1, labels = listOf("Secure", "Phrase", "Verify", "PIN"))
            Spacer(Modifier.height(Spacing.xxl))
            Text("Write down these ${words.size} words", style = MaterialTheme.typography.headlineSmall, color = VfxtTheme.colors.textPrimary)
            Spacer(Modifier.height(Spacing.xs))
            Text(
                "Keep them in order, on paper, somewhere safe. You'll confirm a few of them next.",
                style = MaterialTheme.typography.bodyMedium,
                color = VfxtTheme.colors.textSecondary,
            )
            Spacer(Modifier.height(Spacing.xl))
            RevealablePhrase(words)
            Spacer(Modifier.height(Spacing.xl))
            WarningBanner("Never share this phrase. Screenshots are blocked on this screen and copying is disabled on purpose.")
            Spacer(Modifier.height(Spacing.xl))
        }
        VfxtPrimaryButton(
            "I've written it down",
            onContinue,
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.screen, vertical = Spacing.lg),
        )
    }
}

/** Step 3: confirm three random words, then store the wallet. */
@Composable
fun VerifyPhraseScreen(
    onBack: () -> Unit,
    onRestart: () -> Unit,
    onWalletAdded: (WalletAddedNext) -> Unit,
    viewModel: VerifyPhraseViewModel = hiltViewModel(),
) {
    SecureScreen()
    val colors = VfxtTheme.colors
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { viewModel.added.collect(onWalletAdded) }

    Column(
        Modifier
            .fillMaxSize()
            .background(colors.background)
            .safeDrawingPadding(),
    ) {
        VfxtTopBar("Verify phrase", onBack)
        if (state.sessionLost) {
            SessionLost(onRestart)
            return@Column
        }
        Column(
            Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = Spacing.screen),
        ) {
            StepIndicator(current = 2, labels = listOf("Secure", "Phrase", "Verify", "PIN"))
            Spacer(Modifier.height(Spacing.xxl))
            Text("Confirm your phrase", style = MaterialTheme.typography.headlineSmall, color = colors.textPrimary)
            Spacer(Modifier.height(Spacing.xs))
            Text(
                "Select the correct word for each position to prove your backup is complete.",
                style = MaterialTheme.typography.bodyMedium,
                color = colors.textSecondary,
            )
            Spacer(Modifier.height(Spacing.xl))
            state.challenges.forEach { challenge ->
                val selected = state.selections[challenge.index]
                val correct = selected == challenge.answer
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Word #${challenge.index + 1}", style = MaterialTheme.typography.titleSmall, color = colors.textPrimary)
                    Spacer(Modifier.weight(1f))
                    if (selected != null) {
                        Icon(
                            if (correct) Icons.Outlined.CheckCircle else Icons.Outlined.WarningAmber,
                            contentDescription = if (correct) "Correct" else "Incorrect",
                            tint = if (correct) colors.success else colors.error,
                            modifier = Modifier.size(18.dp),
                        )
                    }
                }
                Spacer(Modifier.height(Spacing.sm))
                Row(horizontalArrangement = Arrangement.spacedBy(Spacing.sm)) {
                    challenge.options.forEach { word ->
                        VfxtChip(
                            label = word,
                            selected = selected == word,
                            onClick = { viewModel.select(challenge.index, word) },
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
                Spacer(Modifier.height(Spacing.xl))
            }
            state.error?.let {
                Text(it, style = MaterialTheme.typography.bodyMedium, color = colors.error, textAlign = TextAlign.Start)
                Spacer(Modifier.height(Spacing.md))
            }
        }
        VfxtPrimaryButton(
            "Create wallet",
            viewModel::confirm,
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.screen, vertical = Spacing.lg),
            enabled = state.selections.size == state.challenges.size && state.challenges.isNotEmpty(),
            loading = state.saving,
        )
    }
}
