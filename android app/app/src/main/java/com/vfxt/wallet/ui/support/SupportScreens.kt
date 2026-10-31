package com.vfxt.wallet.ui.support

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.HelpOutline
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.SupportAgent
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.vfxt.wallet.core.designsystem.components.EmptyState
import com.vfxt.wallet.core.designsystem.components.IconTile
import com.vfxt.wallet.core.designsystem.components.SectionHeader
import com.vfxt.wallet.core.designsystem.components.VfxtCard
import com.vfxt.wallet.core.designsystem.components.VfxtTopBar
import com.vfxt.wallet.core.designsystem.theme.Spacing
import com.vfxt.wallet.core.designsystem.theme.VfxtTheme

@Composable
fun NotificationsScreen(onBack: () -> Unit) {
    Column(Modifier.fillMaxSize()) {
        VfxtTopBar("Notifications", onBack)
        Column(Modifier.padding(horizontal = Spacing.screen)) {
            VfxtCard(Modifier.fillMaxWidth(), contentPadding = PaddingValues(Spacing.xs)) {
                EmptyState(
                    icon = Icons.Outlined.Notifications,
                    title = "You're all caught up",
                    message = "Mining, claim and security alerts will appear here when push notifications are enabled for your account.",
                )
            }
        }
    }
}

@Composable
fun SupportScreen(onBack: () -> Unit) {
    val colors = VfxtTheme.colors
    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState()),
    ) {
        VfxtTopBar("Customer support", onBack)
        Column(
            Modifier.padding(horizontal = Spacing.screen),
            verticalArrangement = Arrangement.spacedBy(Spacing.lg),
        ) {
            VfxtCard(Modifier.fillMaxWidth()) {
                IconTile(Icons.Outlined.SupportAgent, colors.primary, size = 44.dp)
                Spacer(Modifier.height(Spacing.md))
                Text("We're here to help", style = MaterialTheme.typography.titleMedium, color = colors.textPrimary)
                Spacer(Modifier.height(Spacing.xs))
                Text(
                    "For wallet recovery, never share your phrase with anyone — including VFXT support. We can help with mining claims, app issues and account status.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = colors.textSecondary,
                )
            }
            SectionHeader("Contact")
            VfxtCard(Modifier.fillMaxWidth()) {
                Text("Email", style = MaterialTheme.typography.labelMedium, color = colors.textSecondary)
                Spacer(Modifier.height(4.dp))
                Text("support@virtualfxtrades.com", style = MaterialTheme.typography.titleSmall, color = colors.textPrimary)
                Spacer(Modifier.height(Spacing.md))
                Text("Response time", style = MaterialTheme.typography.labelMedium, color = colors.textSecondary)
                Spacer(Modifier.height(4.dp))
                Text("Usually within 1–2 business days", style = MaterialTheme.typography.bodyMedium, color = colors.textPrimary)
            }
            SectionHeader("FAQs")
            FaqCard(
                "How do I restore my wallet?",
                "Use Import Wallet with your 12/24-word recovery phrase or private key. The phrase never leaves your device.",
            )
            FaqCard(
                "Are mining rewards on-chain immediately?",
                "Mining rewards are tracked by the VFXT server. Claims are paid to your wallet after the configured payout policy (admin approval or automatic).",
            )
            FaqCard(
                "Is trading real?",
                "The Trade tab is a DEMO preview. Prices and balances there are simulated and never use your wallet funds.",
            )
            Spacer(Modifier.height(Spacing.xxl))
        }
    }
}

@Composable
private fun FaqCard(question: String, answer: String) {
    val colors = VfxtTheme.colors
    VfxtCard(Modifier.fillMaxWidth()) {
        IconTile(Icons.Outlined.HelpOutline, colors.electric, size = 32.dp)
        Spacer(Modifier.height(Spacing.sm))
        Text(question, style = MaterialTheme.typography.titleSmall, color = colors.textPrimary)
        Spacer(Modifier.height(Spacing.xs))
        Text(answer, style = MaterialTheme.typography.bodyMedium, color = colors.textSecondary)
    }
}

@Composable
fun LegalScreen(title: String, body: String, onBack: () -> Unit) {
    val colors = VfxtTheme.colors
    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState()),
    ) {
        VfxtTopBar(title, onBack)
        Column(Modifier.padding(horizontal = Spacing.screen)) {
            VfxtCard(Modifier.fillMaxWidth()) {
                Text(body, style = MaterialTheme.typography.bodyMedium, color = colors.textSecondary)
            }
            Spacer(Modifier.height(Spacing.xxl))
        }
    }
}
