package com.vfxt.wallet.ui.support

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.outlined.Bolt
import androidx.compose.material.icons.outlined.DoneAll
import androidx.compose.material.icons.outlined.NorthEast
import androidx.compose.material.icons.outlined.NotificationsOff
import androidx.compose.material.icons.outlined.Shield
import androidx.compose.material.icons.outlined.SouthWest
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.vfxt.wallet.core.common.Formatters
import com.vfxt.wallet.core.designsystem.components.SkeletonListRow
import com.vfxt.wallet.core.designsystem.components.VfxtBottomSheet
import com.vfxt.wallet.core.designsystem.components.VfxtIconButton
import com.vfxt.wallet.data.repository.AppNotification
import com.vfxt.wallet.data.repository.NotificationsState
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
fun NotificationsScreen(onBack: () -> Unit, viewModel: NotificationsViewModel = hiltViewModel()) {
    val colors = VfxtTheme.colors
    val state by viewModel.state.collectAsStateWithLifecycle()
    var opened by remember { mutableStateOf<AppNotification?>(null) }
    val items = (state as? NotificationsState.Ready)?.items.orEmpty()

    Column(Modifier.fillMaxSize()) {
        VfxtTopBar(
            "Notifications",
            onBack,
            trailing = if (items.any { !it.read }) {
                { VfxtIconButton(Icons.Outlined.DoneAll, "Mark all as read", viewModel::markAllRead) }
            } else {
                null
            },
        )
        when (val s = state) {
            NotificationsState.Loading -> Column(Modifier.padding(horizontal = Spacing.screen)) {
                repeat(4) { SkeletonListRow() }
            }
            is NotificationsState.Unavailable -> Column(Modifier.padding(horizontal = Spacing.screen)) {
                VfxtCard(Modifier.fillMaxWidth(), contentPadding = PaddingValues(Spacing.xs)) {
                    EmptyState(Icons.Outlined.NotificationsOff, "Notifications unavailable", s.message)
                }
            }
            is NotificationsState.Ready -> if (s.items.isEmpty()) {
                Column(Modifier.padding(horizontal = Spacing.screen)) {
                    VfxtCard(Modifier.fillMaxWidth(), contentPadding = PaddingValues(Spacing.xs)) {
                        EmptyState(
                            icon = Icons.Outlined.Notifications,
                            title = "You're all caught up",
                            message = "Mining, claim, deposit and security alerts for your account will appear here.",
                        )
                    }
                }
            } else {
                LazyColumn(
                    contentPadding = PaddingValues(horizontal = Spacing.screen, vertical = Spacing.sm),
                    verticalArrangement = Arrangement.spacedBy(Spacing.sm),
                ) {
                    items(s.items, key = { it.id }) { item ->
                        NotificationRow(item) {
                            viewModel.open(item)
                            opened = item
                        }
                    }
                }
            }
        }
    }

    opened?.let { item ->
        VfxtBottomSheet(onDismiss = { opened = null }) {
            Text(item.title, style = MaterialTheme.typography.headlineSmall, color = colors.textPrimary)
            item.createdAtMillis?.let {
                Text(Formatters.dateTime(it), style = MaterialTheme.typography.bodySmall, color = colors.textMuted)
            }
            Spacer(Modifier.height(Spacing.md))
            Text(item.body, style = MaterialTheme.typography.bodyLarge, color = colors.textSecondary)
            Spacer(Modifier.height(Spacing.lg))
        }
    }
}

@Composable
private fun NotificationRow(item: AppNotification, onClick: () -> Unit) {
    val colors = VfxtTheme.colors
    val (icon, tint) = when {
        item.type.contains("deposit", true) -> Icons.Outlined.SouthWest to colors.success
        item.type.contains("withdraw", true) -> Icons.Outlined.NorthEast to colors.primary
        item.type.contains("mining", true) || item.type.contains("claim", true) -> Icons.Outlined.Bolt to colors.electric
        item.type.contains("security", true) -> Icons.Outlined.Shield to colors.warning
        else -> Icons.Outlined.Notifications to colors.accent
    }
    VfxtCard(Modifier.fillMaxWidth(), onClick = onClick, contentPadding = PaddingValues(Spacing.md)) {
        Row(verticalAlignment = Alignment.Top) {
            IconTile(icon, tint, size = 40.dp)
            Spacer(Modifier.width(Spacing.md))
            Column(Modifier.weight(1f)) {
                Text(
                    item.title,
                    style = MaterialTheme.typography.titleSmall,
                    color = colors.textPrimary,
                    fontWeight = if (item.read) FontWeight.Normal else FontWeight.SemiBold,
                )
                Text(item.body, style = MaterialTheme.typography.bodySmall, color = colors.textSecondary, maxLines = 2, overflow = TextOverflow.Ellipsis)
                item.createdAtMillis?.let {
                    Spacer(Modifier.height(2.dp))
                    Text(Formatters.dateTime(it), style = MaterialTheme.typography.labelSmall, color = colors.textMuted)
                }
            }
            if (!item.read) {
                Spacer(Modifier.width(Spacing.sm))
                Box(Modifier.padding(top = 6.dp).size(8.dp).clip(CircleShape).background(colors.primary))
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
