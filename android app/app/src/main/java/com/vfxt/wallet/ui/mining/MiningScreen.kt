package com.vfxt.wallet.ui.mining

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.outlined.History
import androidx.compose.material.icons.outlined.Redeem
import androidx.compose.material.icons.automirrored.outlined.Rule
import androidx.compose.material.icons.outlined.Speed
import androidx.compose.material.icons.outlined.Timer
import androidx.compose.material.icons.outlined.Savings
import androidx.compose.material.icons.outlined.WorkspacePremium
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import com.vfxt.wallet.core.common.Formatters
import com.vfxt.wallet.core.common.UNKNOWN_VALUE
import com.vfxt.wallet.core.designsystem.components.EmptyState
import com.vfxt.wallet.core.designsystem.components.ErrorState
import com.vfxt.wallet.core.designsystem.components.IconTile
import com.vfxt.wallet.core.designsystem.components.PillTone
import com.vfxt.wallet.core.designsystem.components.ScreenHeader
import com.vfxt.wallet.core.designsystem.components.SectionHeader
import com.vfxt.wallet.core.designsystem.components.SkeletonBlock
import com.vfxt.wallet.core.designsystem.components.StatusPill
import com.vfxt.wallet.core.designsystem.components.VfxtBottomSheet
import com.vfxt.wallet.core.designsystem.components.VfxtCard
import com.vfxt.wallet.core.designsystem.components.VfxtPrimaryButton
import com.vfxt.wallet.core.designsystem.components.VfxtSecondaryButton
import com.vfxt.wallet.core.designsystem.components.VfxtTextButton
import com.vfxt.wallet.core.designsystem.theme.Spacing
import com.vfxt.wallet.core.designsystem.theme.VfxtTheme
import com.vfxt.wallet.domain.models.BoosterPurchaseOrder
import com.vfxt.wallet.domain.models.MiningBooster
import com.vfxt.wallet.domain.models.MiningConfig
import com.vfxt.wallet.domain.models.MiningHistoryItem
import com.vfxt.wallet.domain.models.MiningOverview
import com.vfxt.wallet.domain.models.MiningSession
import com.vfxt.wallet.domain.models.MiningStatus
import com.vfxt.wallet.domain.models.RewardSummary
import kotlinx.coroutines.delay
import java.math.BigDecimal
import java.math.RoundingMode
import java.util.Locale

@Composable
fun MiningScreen(
    onNotify: (String) -> Unit,
    viewModel: MiningViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    LaunchedEffect(state.notice) {
        state.notice?.let {
            onNotify(it)
            viewModel.consumeNotice()
        }
    }
    MiningContent(
        state = state,
        onRetry = viewModel::load,
        onStart = viewModel::startMining,
        onStop = viewModel::stopMining,
        onClaim = viewModel::claimRewards,
        onOpenBoosters = viewModel::openBoosters,
        onCloseBoosters = viewModel::closeBoosters,
        onSelectBooster = viewModel::selectBooster,
        onPayVfxt = viewModel::payWithVfxtWallet,
    )
}

@Composable
fun MiningContent(
    state: MiningUiState,
    onRetry: () -> Unit,
    onStart: () -> Unit,
    onStop: () -> Unit,
    onClaim: () -> Unit,
    onOpenBoosters: () -> Unit = {},
    onCloseBoosters: () -> Unit = {},
    onSelectBooster: (String) -> Unit = {},
    onPayVfxt: () -> Unit = {},
) {
    var showRules by remember { mutableStateOf(false) }
    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState()),
    ) {
        ScreenHeader(
            "Mining",
            subtitle = "Earn VFXT with daily sessions",
            trailing = { VfxtTextButton("Rules", { showRules = true }) },
        )
        Column(Modifier.padding(horizontal = Spacing.screen)) {
            val overview = state.overview
            when {
                state.isLoading -> MiningSkeleton()
                overview == null -> ErrorState(state.errorMessage ?: "Mining status is unavailable.", onRetry)
                else -> {
                    MiningHero(
                        overview.status,
                        onStart = onStart,
                        onStop = onStop,
                        actionInProgress = state.actionInProgress,
                    )
                    Spacer(Modifier.height(Spacing.lg))
                    MiningStats(overview)
                    Spacer(Modifier.height(Spacing.lg))
                    BoostersCard(
                        overview = overview,
                        onOpenBoosters = onOpenBoosters,
                        actionInProgress = state.actionInProgress,
                    )
                    Spacer(Modifier.height(Spacing.lg))
                    ClaimCard(
                        overview,
                        onClaim = onClaim,
                        actionInProgress = state.actionInProgress,
                    )
                    Spacer(Modifier.height(Spacing.xxl))
                    SectionHeader("Mining history")
                    Spacer(Modifier.height(Spacing.sm))
                    HistoryCard(overview.history)
                }
            }
            Spacer(Modifier.height(Spacing.xxl))
        }
    }
    if (showRules) MiningRulesSheet(onDismiss = { showRules = false })
    if (state.showBoosters) {
        BoosterShopSheet(
            state = state,
            onDismiss = onCloseBoosters,
            onSelect = onSelectBooster,
            onPayVfxt = onPayVfxt,
        )
    }
}

@Composable
private fun HistoryCard(history: List<MiningHistoryItem>) {
    VfxtCard(Modifier.fillMaxWidth(), contentPadding = PaddingValues(Spacing.xs)) {
        if (history.isEmpty()) {
            EmptyState(
                icon = Icons.Outlined.History,
                title = "No sessions yet",
                message = "Completed mining sessions and their rewards will be listed here.",
            )
        } else {
            history.forEachIndexed { index, item ->
                HistoryRow(item)
                if (index != history.lastIndex) {
                    Spacer(Modifier.height(Spacing.sm))
                }
            }
        }
    }
}

@Composable
private fun HistoryRow(item: MiningHistoryItem) {
    val colors = VfxtTheme.colors
    Row(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = Spacing.md, vertical = Spacing.sm),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        IconTile(Icons.Outlined.History, colors.primary, size = 36.dp)
        Spacer(Modifier.width(Spacing.md))
        Column(Modifier.weight(1f)) {
            Text(
                item.sessionId.take(8).uppercase(Locale.US),
                style = MaterialTheme.typography.titleSmall,
                color = colors.textPrimary,
            )
            Text(
                Formatters.dateTime(item.startTimeMillis),
                style = MaterialTheme.typography.bodySmall,
                color = colors.textSecondary,
            )
        }
        Text(
            item.reward?.let { "+${Formatters.tokenAmount(it, 4)} VFXT" } ?: UNKNOWN_VALUE,
            style = MaterialTheme.typography.titleSmall,
            color = colors.success,
        )
    }
}

@Composable
private fun MiningSkeleton() {
    VfxtCard(Modifier.fillMaxWidth()) {
        Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
            SkeletonBlock(Modifier.size(200.dp), androidx.compose.foundation.shape.CircleShape)
        }
        Spacer(Modifier.height(Spacing.lg))
        SkeletonBlock(Modifier.fillMaxWidth().height(54.dp))
    }
    Spacer(Modifier.height(Spacing.lg))
    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.md)) {
        repeat(2) { SkeletonBlock(Modifier.weight(1f).height(84.dp)) }
    }
}

/** Ring + countdown. Progress and countdown are derived from server timestamps only. */
@Composable
private fun MiningHero(
    status: MiningStatus,
    onStart: () -> Unit,
    onStop: () -> Unit,
    actionInProgress: Boolean,
) {
    val colors = VfxtTheme.colors
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    if (status is MiningStatus.Active) {
        LaunchedEffect(status.session.sessionId) {
            while (true) {
                now = System.currentTimeMillis()
                delay(1000)
            }
        }
    }
    val spin = rememberInfiniteTransition(label = "miningSpin")
    val sweepStart by spin.animateFloat(
        0f, 360f, infiniteRepeatable(tween(4000, easing = LinearEasing), RepeatMode.Restart), label = "sweep",
    )

    val (label, pillTone, detail) = when (status) {
        is MiningStatus.ServiceUnavailable -> Triple("Offline", PillTone.Neutral, status.reason)
        is MiningStatus.Disabled -> Triple("Paused", PillTone.Warning, "Mining is temporarily paused by VFXT.")
        is MiningStatus.Idle -> Triple("Ready", PillTone.Primary, "Start a session to begin earning.")
        is MiningStatus.Active -> Triple("Mining", PillTone.Success, "Session in progress")
    }
    val progress = (status as? MiningStatus.Active)?.session?.let { s ->
        ((now - s.startTimeMillis).toFloat() / (s.endTimeMillis - s.startTimeMillis)).coerceIn(0f, 1f)
    }

    VfxtCard(Modifier.fillMaxWidth(), contentPadding = PaddingValues(Spacing.xl)) {
        Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
            Canvas(
                Modifier
                    .size(208.dp)
                    .semantics { contentDescription = "Mining status: $label" },
            ) {
                val stroke = 12.dp.toPx()
                val arcSize = Size(size.width - stroke, size.height - stroke)
                val topLeft = Offset(stroke / 2, stroke / 2)
                drawArc(colors.cardRaised, 0f, 360f, false, topLeft, arcSize, style = Stroke(stroke))
                val brush = Brush.sweepGradient(listOf(colors.electric, colors.accent, colors.primary, colors.electric))
                when {
                    progress != null -> drawArc(brush, -90f, 360f * progress, false, topLeft, arcSize, style = Stroke(stroke, cap = StrokeCap.Round))
                    status is MiningStatus.Idle -> drawArc(brush, sweepStart, 60f, false, topLeft, arcSize, style = Stroke(stroke, cap = StrokeCap.Round))
                    else -> Unit
                }
                drawCircle(
                    Brush.radialGradient(listOf(colors.primary.copy(alpha = if (progress != null) 0.25f else 0.1f), colors.card.copy(alpha = 0f))),
                    radius = size.minDimension / 2 - stroke * 2,
                )
            }
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(Icons.Filled.Bolt, null, tint = if (progress != null) colors.electric else colors.textMuted, modifier = Modifier.size(28.dp))
                Spacer(Modifier.height(Spacing.xs))
                val session = (status as? MiningStatus.Active)?.session
                Text(
                    if (session != null) formatCountdown(session.endTimeMillis - now) else "--:--:--",
                    style = MaterialTheme.typography.displaySmall,
                    color = colors.textPrimary,
                )
                Spacer(Modifier.height(Spacing.xs))
                StatusPill(label, tone = pillTone, showDot = true)
            }
        }
        Spacer(Modifier.height(Spacing.lg))
        Text(detail, style = MaterialTheme.typography.bodyMedium, color = colors.textSecondary, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())

        if (status is MiningStatus.Active) {
            val elapsedSeconds = ((now - status.session.startTimeMillis) / 1000).coerceAtLeast(0)
                .coerceAtMost((status.session.endTimeMillis - status.session.startTimeMillis) / 1000)
            // Display-only estimate: Rate × elapsed / 3600. The server ledger is authoritative.
            val estimate = status.session.rateSnapshotPerHour
                .multiply(BigDecimal.valueOf(elapsedSeconds))
                .divide(BigDecimal.valueOf(3600), 8, RoundingMode.DOWN)
            Spacer(Modifier.height(Spacing.md))
            Text(
                "≈ ${Formatters.tokenAmount(estimate, 6)} VFXT this session",
                style = MaterialTheme.typography.titleMedium,
                color = colors.electric,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
            Text(
                "Estimate · final amount confirmed by the server",
                style = MaterialTheme.typography.bodySmall,
                color = colors.textMuted,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
        }

        Spacer(Modifier.height(Spacing.lg))
        if (actionInProgress) {
            Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = colors.primary, strokeWidth = 2.dp, modifier = Modifier.size(28.dp))
            }
        } else {
            when (status) {
                is MiningStatus.Active -> VfxtSecondaryButton(
                    "Stop mining",
                    onStop,
                    Modifier.fillMaxWidth(),
                    enabled = status.config.allowStop,
                )
                else -> VfxtPrimaryButton(
                    "Start mining",
                    onStart,
                    Modifier.fillMaxWidth(),
                    enabled = status is MiningStatus.Idle,
                    icon = Icons.Filled.Bolt,
                )
            }
        }
    }
}

private fun formatCountdown(remainingMillis: Long): String {
    val total = (remainingMillis / 1000).coerceAtLeast(0)
    return String.format(Locale.US, "%02d:%02d:%02d", total / 3600, (total % 3600) / 60, total % 60)
}

private fun MiningStatus.configOrNull(): MiningConfig? = when (this) {
    is MiningStatus.Active -> config
    is MiningStatus.Idle -> config
    is MiningStatus.Disabled -> config
    is MiningStatus.ServiceUnavailable -> null
}

@Composable
private fun MiningStats(overview: MiningOverview) {
    val config = overview.status.configOrNull()
    val rewards = overview.rewards
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.md)) {
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.md)) {
            StatTile(Icons.Outlined.Speed, "Mining speed", config?.let { "${Formatters.tokenAmount(it.ratePerHour, 4)}/h" } ?: UNKNOWN_VALUE, Modifier.weight(1f))
            StatTile(Icons.Outlined.Timer, "Session length", config?.let { "${it.durationSeconds / 3600}h" } ?: UNKNOWN_VALUE, Modifier.weight(1f))
        }
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.md)) {
            StatTile(Icons.Outlined.Savings, "Available", rewards?.let { Formatters.tokenAmount(it.available, 4) } ?: UNKNOWN_VALUE, Modifier.weight(1f))
            StatTile(Icons.Outlined.WorkspacePremium, "Lifetime", rewards?.let { Formatters.tokenAmount(it.lifetime, 4) } ?: UNKNOWN_VALUE, Modifier.weight(1f))
        }
    }
}

@Composable
private fun StatTile(icon: ImageVector, label: String, value: String, modifier: Modifier = Modifier) {
    val colors = VfxtTheme.colors
    VfxtCard(modifier, contentPadding = PaddingValues(Spacing.lg)) {
        IconTile(icon, colors.primary, size = 32.dp)
        Spacer(Modifier.height(Spacing.md))
        Text(label, style = MaterialTheme.typography.labelMedium, color = colors.textSecondary)
        Spacer(Modifier.height(2.dp))
        Text(value, style = MaterialTheme.typography.titleLarge, color = colors.textPrimary, maxLines = 1)
    }
}

@Composable
private fun BoostersCard(
    overview: MiningOverview,
    onOpenBoosters: () -> Unit,
    actionInProgress: Boolean,
) {
    val colors = VfxtTheme.colors
    val effective = overview.effectiveRatePerHour
    VfxtCard(Modifier.fillMaxWidth()) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconTile(Icons.Filled.Bolt, colors.electric, size = 44.dp)
            Spacer(Modifier.width(Spacing.md))
            Column(Modifier.weight(1f)) {
                Text("Speed boosters", style = MaterialTheme.typography.titleMedium, color = colors.textPrimary)
                Text(
                    if (overview.activeBoosters.isEmpty()) {
                        "Pay with your VFXT Wallet only (USDT BEP-20)."
                    } else {
                        "${overview.activeBoosters.size} active · effective ${effective?.let { Formatters.tokenAmount(it, 4) } ?: UNKNOWN_VALUE}/h"
                    },
                    style = MaterialTheme.typography.bodySmall,
                    color = colors.textSecondary,
                )
            }
        }
        if (overview.activeBoosters.isNotEmpty()) {
            Spacer(Modifier.height(Spacing.md))
            overview.activeBoosters.take(3).forEach { b ->
                Text(
                    "${b.boosterName} · +${Formatters.tokenAmount(b.bonusRatePerHour, 4)}/h",
                    style = MaterialTheme.typography.bodySmall,
                    color = colors.textPrimary,
                )
            }
        }
        Spacer(Modifier.height(Spacing.lg))
        VfxtSecondaryButton(
            "Buy booster",
            onOpenBoosters,
            Modifier.fillMaxWidth(),
            enabled = !actionInProgress,
        )
    }
}

@Composable
private fun BoosterShopSheet(
    state: MiningUiState,
    onDismiss: () -> Unit,
    onSelect: (String) -> Unit,
    onPayVfxt: () -> Unit,
) {
    val colors = VfxtTheme.colors
    val order = state.pendingOrder
    VfxtBottomSheet(onDismiss) {
        Text("Buy mining booster", style = MaterialTheme.typography.headlineSmall, color = colors.textPrimary)
        Spacer(Modifier.height(Spacing.sm))
        Text(
            "Payment is USDT (BEP-20) signed and sent only from your VFXT Wallet in this app.",
            style = MaterialTheme.typography.bodyMedium,
            color = colors.textSecondary,
        )
        Spacer(Modifier.height(Spacing.lg))

        when {
            state.boostersLoading -> {
                Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = colors.primary, strokeWidth = 2.dp, modifier = Modifier.size(28.dp))
                }
            }
            order != null -> BoosterPaymentPanel(
                order = order,
                actionInProgress = state.actionInProgress,
                onPayVfxt = onPayVfxt,
            )
            state.boosters.isEmpty() -> EmptyState(
                icon = Icons.Filled.Bolt,
                title = "No boosters listed",
                message = "Ask an admin to add boosters in the VFXT admin panel.",
            )
            else -> {
                state.boosters.forEach { booster ->
                    BoosterCatalogRow(
                        booster = booster,
                        enabled = !state.actionInProgress,
                        onBuy = { onSelect(booster.boosterId) },
                    )
                    Spacer(Modifier.height(Spacing.md))
                }
            }
        }
        Spacer(Modifier.height(Spacing.md))
    }
}

@Composable
private fun BoosterCatalogRow(booster: MiningBooster, enabled: Boolean, onBuy: () -> Unit) {
    val colors = VfxtTheme.colors
    VfxtCard(Modifier.fillMaxWidth()) {
        Text(booster.name, style = MaterialTheme.typography.titleMedium, color = colors.textPrimary)
        if (booster.description.isNotBlank()) {
            Text(booster.description, style = MaterialTheme.typography.bodySmall, color = colors.textSecondary)
        }
        Spacer(Modifier.height(Spacing.sm))
        Text(
            "+${Formatters.tokenAmount(booster.bonusRatePerHour, 4)} VFXT/h · ${booster.durationSeconds / 3600}h · ${booster.priceUsdt} USDT",
            style = MaterialTheme.typography.bodyMedium,
            color = colors.electric,
        )
        Spacer(Modifier.height(Spacing.md))
        VfxtPrimaryButton("Buy with USDT", onBuy, Modifier.fillMaxWidth(), enabled = enabled)
    }
}

@Composable
private fun BoosterPaymentPanel(
    order: BoosterPurchaseOrder,
    actionInProgress: Boolean,
    onPayVfxt: () -> Unit,
) {
    val colors = VfxtTheme.colors
    VfxtCard(Modifier.fillMaxWidth()) {
        Text(order.boosterName, style = MaterialTheme.typography.titleMedium, color = colors.textPrimary)
        Spacer(Modifier.height(Spacing.sm))
        Text("Amount (USDT BEP-20)", style = MaterialTheme.typography.labelMedium, color = colors.textSecondary)
        Text(order.priceUsdt, style = MaterialTheme.typography.headlineSmall, color = colors.electric)
        Spacer(Modifier.height(Spacing.md))
        Text(
            "Your VFXT Wallet signs and sends this USDT (BEP-20) payment on BNB Smart Chain. Payment from other apps is not available.",
            style = MaterialTheme.typography.bodySmall,
            color = colors.textSecondary,
        )
        Spacer(Modifier.height(Spacing.lg))
        if (actionInProgress) {
            Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = colors.primary, strokeWidth = 2.dp, modifier = Modifier.size(28.dp))
            }
        } else {
            VfxtPrimaryButton("Pay with VFXT Wallet", onPayVfxt, Modifier.fillMaxWidth())
        }
    }
}

@Composable
private fun ClaimCard(overview: MiningOverview, onClaim: () -> Unit, actionInProgress: Boolean) {
    val colors = VfxtTheme.colors
    val config = overview.status.configOrNull()
    val rewards = overview.rewards
    val canClaim = !actionInProgress &&
        rewards != null &&
        config != null &&
        rewards.available >= config.minimumClaim &&
        rewards.available.signum() > 0
    VfxtCard(Modifier.fillMaxWidth()) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconTile(Icons.Outlined.Redeem, colors.accent, size = 44.dp)
            Spacer(Modifier.width(Spacing.md))
            Column(Modifier.weight(1f)) {
                Text("Claim rewards", style = MaterialTheme.typography.titleMedium, color = colors.textPrimary)
                Text(
                    if (rewards == null) {
                        "Sign in with your wallet to claim mining rewards."
                    } else {
                        "Minimum claim: ${config?.let { Formatters.tokenAmount(it.minimumClaim) } ?: UNKNOWN_VALUE} VFXT"
                    },
                    style = MaterialTheme.typography.bodySmall,
                    color = colors.textSecondary,
                )
            }
        }
        if (rewards != null) {
            Spacer(Modifier.height(Spacing.md))
            Row {
                Text("Claimed to date", style = MaterialTheme.typography.bodyMedium, color = colors.textSecondary, modifier = Modifier.weight(1f))
                Text("${Formatters.tokenAmount(rewards.claimed)} VFXT", style = MaterialTheme.typography.titleSmall, color = colors.textPrimary)
            }
        }
        Spacer(Modifier.height(Spacing.lg))
        VfxtPrimaryButton("Claim VFXT", onClaim, Modifier.fillMaxWidth(), enabled = canClaim)
    }
}

@Composable
private fun MiningRulesSheet(onDismiss: () -> Unit) {
    val colors = VfxtTheme.colors
    VfxtBottomSheet(onDismiss) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconTile(Icons.AutoMirrored.Outlined.Rule, colors.primary, size = 44.dp)
            Spacer(Modifier.width(Spacing.md))
            Text("Mining rules", style = MaterialTheme.typography.headlineSmall, color = colors.textPrimary)
        }
        Spacer(Modifier.height(Spacing.lg))
        listOf(
            "Rewards are calculated by the VFXT server: Reward = Rate per hour × Elapsed seconds ÷ 3600.",
            "Session length, mining rate, reward caps and minimum claim are set by VFXT and may change.",
            "Only one active session per account. Times are taken from the server, not your device.",
            "Rewards are credited to your reward balance when a session completes.",
            "Claims are sent to your wallet address on BNB Smart Chain after review or automatically, depending on the current payout policy.",
        ).forEachIndexed { i, rule ->
            Row(Modifier.padding(vertical = Spacing.xs)) {
                Box(
                    Modifier
                        .size(22.dp)
                        .background(colors.primary.copy(alpha = 0.16f), androidx.compose.foundation.shape.CircleShape),
                    contentAlignment = Alignment.Center,
                ) { Text("${i + 1}", style = MaterialTheme.typography.labelMedium, color = colors.primary) }
                Spacer(Modifier.width(Spacing.md))
                Text(rule, style = MaterialTheme.typography.bodyMedium, color = colors.textSecondary)
            }
        }
        Spacer(Modifier.height(Spacing.lg))
        VfxtPrimaryButton("Got it", onDismiss, Modifier.fillMaxWidth())
    }
}

// --- Previews (sample data is confined to previews) ---------------------------------------

private val previewConfig = MiningConfig(true, BigDecimal("2.5"), 24 * 3600, BigDecimal("50"), allowStop = false)

@Preview(name = "Mining – service unavailable")
@Composable
private fun MiningUnavailablePreview() {
    VfxtTheme {
        Box(Modifier.background(VfxtTheme.colors.background)) {
            MiningContent(
                MiningUiState(false, MiningOverview(MiningStatus.ServiceUnavailable("The mining service will be connected in an upcoming update."), null, emptyList())),
                {}, {}, {}, {},
            )
        }
    }
}

@Preview(name = "Mining – PREVIEW SAMPLE DATA")
@Composable
private fun MiningActivePreview() {
    val now = System.currentTimeMillis()
    VfxtTheme {
        Box(Modifier.background(VfxtTheme.colors.background)) {
            MiningContent(
                MiningUiState(
                    false,
                    MiningOverview(
                        MiningStatus.Active(previewConfig, MiningSession("s1", now - 9 * 3600_000L, now + 15 * 3600_000L, BigDecimal("2.5"))),
                        RewardSummary(BigDecimal("72.5"), BigDecimal("310"), BigDecimal("237.5")),
                        emptyList(),
                    ),
                ),
                {}, {}, {}, {},
            )
        }
    }
}
