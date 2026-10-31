package com.vfxt.wallet.ui.trading

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CandlestickChart
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material.icons.automirrored.outlined.ReceiptLong
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import com.vfxt.wallet.core.designsystem.components.ComingSoonSheet
import com.vfxt.wallet.core.designsystem.components.DemoBadge
import com.vfxt.wallet.core.designsystem.components.EmptyState
import com.vfxt.wallet.core.designsystem.components.PillTone
import com.vfxt.wallet.core.designsystem.components.ScreenHeader
import com.vfxt.wallet.core.designsystem.components.SectionHeader
import com.vfxt.wallet.core.designsystem.components.StatItem
import com.vfxt.wallet.core.designsystem.components.StatusPill
import com.vfxt.wallet.core.designsystem.components.TokenIcon
import com.vfxt.wallet.core.designsystem.components.VfxtCard
import com.vfxt.wallet.core.designsystem.components.VfxtChip
import com.vfxt.wallet.core.designsystem.components.VfxtPrimaryButton
import com.vfxt.wallet.core.designsystem.components.VfxtSegmentedControl
import com.vfxt.wallet.core.designsystem.components.VfxtToneButton
import com.vfxt.wallet.core.designsystem.theme.Spacing
import com.vfxt.wallet.core.designsystem.theme.VfxtTheme
import com.vfxt.wallet.data.demo.ChartInterval
import com.vfxt.wallet.data.demo.DemoMarketData
import java.util.Locale

@Composable
fun TradingScreen(viewModel: TradingViewModel = hiltViewModel()) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    TradingContent(
        state = state,
        onIntervalSelected = viewModel::selectInterval,
        onSideSelected = viewModel::selectSide,
        onAmountChange = viewModel::updateAmount,
    )
}

@Composable
fun TradingContent(
    state: TradingUiState,
    onIntervalSelected: (ChartInterval) -> Unit,
    onSideSelected: (OrderSide) -> Unit,
    onAmountChange: (String) -> Unit,
) {
    val colors = VfxtTheme.colors
    val focusManager = LocalFocusManager.current
    var comingSoonSide by rememberSaveable { mutableStateOf<OrderSide?>(null) }
    // Close the keyboard first so it doesn't cover the sheet while both animate.
    val showComingSoon = { side: OrderSide ->
        focusManager.clearFocus()
        comingSoonSide = side
    }
    var ordersTab by rememberSaveable { mutableIntStateOf(0) }
    val ticker = state.ticker

    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState()),
    ) {
        ScreenHeader("Trade", subtitle = "Trading preview", trailing = { DemoBadge() })
        Column(Modifier.padding(horizontal = Spacing.screen)) {
            DemoNotice()
            Spacer(Modifier.height(Spacing.lg))

            // Pair + ticker
            VfxtCard(Modifier.fillMaxWidth()) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    TokenIcon("VFXT", size = 40.dp)
                    Spacer(Modifier.width(Spacing.md))
                    Column(Modifier.weight(1f)) {
                        Text(DemoMarketData.PAIR, style = MaterialTheme.typography.titleMedium, color = colors.textPrimary)
                        Text("Simulated market", style = MaterialTheme.typography.bodySmall, color = colors.textSecondary)
                    }
                    DemoBadge()
                }
                Spacer(Modifier.height(Spacing.lg))
                Row(verticalAlignment = Alignment.Bottom) {
                    Text(formatPrice(ticker.lastPrice), style = MaterialTheme.typography.displaySmall, color = colors.textPrimary)
                    Spacer(Modifier.width(Spacing.sm))
                    Text("USDT", style = MaterialTheme.typography.bodyMedium, color = colors.textSecondary, modifier = Modifier.padding(bottom = 4.dp))
                    Spacer(Modifier.weight(1f))
                    StatusPill(
                        String.format(Locale.US, "%+.2f%%", ticker.changePercent),
                        tone = if (ticker.changePercent >= 0) PillTone.Success else PillTone.Error,
                    )
                }
                Spacer(Modifier.height(Spacing.lg))
                Row(horizontalArrangement = Arrangement.spacedBy(Spacing.md)) {
                    StatItem("High", formatPrice(ticker.high), Modifier.weight(1f))
                    StatItem("Low", formatPrice(ticker.low), Modifier.weight(1f))
                    StatItem("Volume", compact(ticker.volume), Modifier.weight(1f))
                }
            }
            Spacer(Modifier.height(Spacing.lg))

            // Chart
            Row(
                Modifier.horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(Spacing.sm),
            ) {
                ChartInterval.entries.forEach { interval ->
                    VfxtChip(interval.label, selected = interval == state.interval, onClick = { onIntervalSelected(interval) })
                }
            }
            Spacer(Modifier.height(Spacing.md))
            VfxtCard(Modifier.fillMaxWidth(), contentPadding = PaddingValues(Spacing.md)) {
                CandlestickChart(state.candles, Modifier.fillMaxWidth().height(240.dp))
            }
            Spacer(Modifier.height(Spacing.lg))

            // Order form (demo)
            OrderForm(
                state = state,
                onSideSelected = onSideSelected,
                onAmountChange = onAmountChange,
                onSubmit = { showComingSoon(state.side) },
            )
            Spacer(Modifier.height(Spacing.md))
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.md)) {
                VfxtToneButton("Buy VFXT", colors.success, { showComingSoon(OrderSide.Buy) }, Modifier.weight(1f))
                VfxtToneButton("Sell VFXT", colors.error, { showComingSoon(OrderSide.Sell) }, Modifier.weight(1f))
            }
            Spacer(Modifier.height(Spacing.xxl))

            // Orders
            SectionHeader("Demo orders")
            Spacer(Modifier.height(Spacing.sm))
            VfxtSegmentedControl(
                options = listOf("Open", "Completed", "Cancelled"),
                selectedIndex = ordersTab,
                onSelect = { ordersTab = it },
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(Spacing.md))
            VfxtCard(Modifier.fillMaxWidth(), contentPadding = PaddingValues(Spacing.xs)) {
                EmptyState(
                    icon = Icons.AutoMirrored.Outlined.ReceiptLong,
                    title = when (ordersTab) {
                        0 -> "No open orders"
                        1 -> "No completed orders"
                        else -> "No cancelled orders"
                    },
                    message = "Your demo buy and sell history will appear here once trading launches.",
                )
            }
            Spacer(Modifier.height(Spacing.xxl))
        }
    }

    comingSoonSide?.let { side ->
        ComingSoonSheet(
            title = if (side == OrderSide.Buy) "Buying VFXT is coming soon" else "Selling VFXT is coming soon",
            message = "This screen is a preview with simulated prices. Real trading will be added in a future release.",
            icon = Icons.Outlined.CandlestickChart,
            showDemoNotice = true,
            onDismiss = { comingSoonSide = null },
        )
    }
}

@Composable
private fun DemoNotice() {
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
        Icon(Icons.Outlined.Info, null, tint = colors.warning, modifier = Modifier.size(20.dp))
        Spacer(Modifier.width(Spacing.md))
        Text(
            "Demo preview. Prices, charts, balances and orders are simulated and separate from your wallet.",
            style = MaterialTheme.typography.bodySmall,
            color = colors.textPrimary,
        )
    }
}

@Composable
private fun OrderForm(
    state: TradingUiState,
    onSideSelected: (OrderSide) -> Unit,
    onAmountChange: (String) -> Unit,
    onSubmit: () -> Unit,
) {
    val colors = VfxtTheme.colors
    VfxtCard(Modifier.fillMaxWidth()) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("Order preview", style = MaterialTheme.typography.titleMedium, color = colors.textPrimary, modifier = Modifier.weight(1f))
            DemoBadge()
        }
        Spacer(Modifier.height(Spacing.md))
        VfxtSegmentedControl(
            options = listOf("Buy", "Sell"),
            selectedIndex = state.side.ordinal,
            onSelect = { onSideSelected(OrderSide.entries[it]) },
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(Spacing.md))
        Row {
            Text("Demo balance", style = MaterialTheme.typography.bodySmall, color = colors.textSecondary, modifier = Modifier.weight(1f))
            Text(
                if (state.side == OrderSide.Buy) {
                    String.format(Locale.US, "%,.2f USDT", DemoMarketData.DEMO_USDT_BALANCE)
                } else {
                    "0 VFXT"
                },
                style = MaterialTheme.typography.bodySmall,
                color = colors.textPrimary,
            )
        }
        Spacer(Modifier.height(Spacing.sm))
        OutlinedTextField(
            value = state.amountInput,
            onValueChange = onAmountChange,
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            label = { Text("Amount") },
            suffix = { Text("VFXT", color = colors.textSecondary) },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
            shape = RoundedCornerShape(14.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = colors.primary,
                unfocusedBorderColor = colors.border,
                focusedLabelColor = colors.primary,
                unfocusedLabelColor = colors.textSecondary,
                cursorColor = colors.primary,
                focusedTextColor = colors.textPrimary,
                unfocusedTextColor = colors.textPrimary,
            ),
        )
        Spacer(Modifier.height(Spacing.md))
        Row {
            Text("Estimated value", style = MaterialTheme.typography.bodyMedium, color = colors.textSecondary, modifier = Modifier.weight(1f))
            Text(
                state.estimatedValue?.let { String.format(Locale.US, "%,.4f USDT", it) } ?: "—",
                style = MaterialTheme.typography.titleSmall,
                color = colors.textPrimary,
            )
        }
        Spacer(Modifier.height(Spacing.lg))
        VfxtPrimaryButton(
            text = "Preview ${if (state.side == OrderSide.Buy) "buy" else "sell"} order",
            onClick = onSubmit,
            enabled = state.amount != null,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

private fun compact(value: Double): String = when {
    value >= 1_000_000 -> String.format(Locale.US, "%.2fM", value / 1_000_000)
    value >= 1_000 -> String.format(Locale.US, "%.1fK", value / 1_000)
    else -> String.format(Locale.US, "%.0f", value)
}

@Preview(name = "Trade – DEMO")
@Composable
private fun TradingPreview() {
    VfxtTheme {
        Box(Modifier.background(VfxtTheme.colors.background)) {
            TradingContent(TradingUiState(amountInput = "1500"), {}, {}, {})
        }
    }
}
