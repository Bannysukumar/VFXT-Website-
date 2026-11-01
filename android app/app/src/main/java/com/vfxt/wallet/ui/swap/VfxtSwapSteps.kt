package com.vfxt.wallet.ui.swap

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
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
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.vfxt.wallet.blockchain.swap.VfxtDeskService
import com.vfxt.wallet.blockchain.swap.VfxtRoute
import com.vfxt.wallet.blockchain.swap.VfxtRouteProgress
import com.vfxt.wallet.core.common.Formatters
import com.vfxt.wallet.core.designsystem.components.TokenIcon
import com.vfxt.wallet.core.designsystem.components.VfxtCard
import com.vfxt.wallet.core.designsystem.components.VfxtPrimaryButton
import com.vfxt.wallet.core.designsystem.components.VfxtSecondaryButton
import com.vfxt.wallet.core.designsystem.theme.Spacing
import com.vfxt.wallet.core.designsystem.theme.VfxtTheme
import java.math.BigDecimal
import java.math.BigInteger

private fun amount(raw: BigInteger, decimals: Int): String =
    Formatters.tokenAmount(BigDecimal(raw).movePointLeft(decimals), 6)

@Composable
internal fun VfxtReviewStep(route: VfxtRoute, onConfirm: () -> Unit, onBack: () -> Unit) {
    val colors = VfxtTheme.colors
    Column(Modifier.fillMaxSize()) {
        Column(
            Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = Spacing.screen),
            verticalArrangement = Arrangement.spacedBy(Spacing.lg),
        ) {
            VfxtCard(Modifier.fillMaxWidth()) {
                Leg("You pay", route.fromToken.symbol, route.fromToken.logoUrl, amount(route.amountIn, route.fromToken.decimals))
                Spacer(Modifier.height(Spacing.md))
                HorizontalDivider(color = colors.border.copy(alpha = 0.5f))
                Spacer(Modifier.height(Spacing.md))
                Leg("You receive (at least)", route.toToken.symbol, route.toToken.logoUrl, amount(route.amountOutMin, route.toToken.decimals))
                if (route.amountOut > route.amountOutMin) {
                    Text(
                        "Expected ${amount(route.amountOut, route.toToken.decimals)} ${route.toToken.symbol}",
                        style = MaterialTheme.typography.bodySmall,
                        color = colors.textSecondary,
                    )
                }
            }

            VfxtCard(Modifier.fillMaxWidth()) {
                Line("VFXT price", "1 VFXT = ${VfxtDeskService.display(route.deskPrice)} USDT")
                Line("Network", "BNB Smart Chain")
                Line("Route", if (route.isTwoStep) "2 steps via USDT" else "VFXT Swap (fixed price)")
                if (route.isTwoStep) Line("Slippage (step via LI.FI)", "${route.slippage.movePointRight(2).stripTrailingZeros().toPlainString()}%")
                route.leg?.gasCostUsd?.let { Line("Est. network fee (LI.FI step)", Formatters.fiat(it)) }
            }

            if (route.isTwoStep) {
                VfxtCard(Modifier.fillMaxWidth()) {
                    Text("Steps", style = MaterialTheme.typography.titleSmall, color = colors.textPrimary)
                    Spacer(Modifier.height(Spacing.sm))
                    val usdt = amount(route.usdtAmount, 18)
                    if (route.isBuy) {
                        Text("1. Swap ${route.fromToken.symbol} → ~$usdt USDT (LI.FI)", style = MaterialTheme.typography.bodyMedium, color = colors.textSecondary)
                        Text("2. Buy VFXT with that USDT (VFXT Swap)", style = MaterialTheme.typography.bodyMedium, color = colors.textSecondary)
                    } else {
                        Text("1. Sell VFXT → $usdt USDT (VFXT Swap)", style = MaterialTheme.typography.bodyMedium, color = colors.textSecondary)
                        Text("2. Swap USDT → ${route.toToken.symbol} (LI.FI)", style = MaterialTheme.typography.bodyMedium, color = colors.textSecondary)
                    }
                    Spacer(Modifier.height(Spacing.sm))
                    Text(
                        "Each step is a separate transaction. If step 2 can't complete, you keep the USDT from step 1.",
                        style = MaterialTheme.typography.bodySmall,
                        color = colors.textMuted,
                    )
                }
            }

            Row(verticalAlignment = Alignment.Top) {
                Icon(Icons.Outlined.Info, null, tint = colors.textMuted, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(Spacing.sm))
                Text(
                    "VFXT trades at a fixed price set by VFXT on its swap contract. If the price changes before your trade is confirmed, the VFXT step is cancelled instead of filling at a worse price.",
                    style = MaterialTheme.typography.bodySmall,
                    color = colors.textMuted,
                )
            }
            Spacer(Modifier.height(Spacing.md))
        }
        Column(Modifier.padding(horizontal = Spacing.screen, vertical = Spacing.lg), verticalArrangement = Arrangement.spacedBy(Spacing.sm)) {
            VfxtPrimaryButton("Confirm swap", onConfirm, Modifier.fillMaxWidth())
            VfxtSecondaryButton("Edit", onBack, Modifier.fillMaxWidth())
        }
    }
}

@Composable
internal fun VfxtProgressStep(
    route: VfxtRoute?,
    progress: VfxtRouteProgress?,
    onDone: () -> Unit,
    onActivity: () -> Unit,
) {
    val colors = VfxtTheme.colors
    val uri = LocalUriHandler.current
    val finished = progress is VfxtRouteProgress.Done || progress is VfxtRouteProgress.Failed
    Column(
        Modifier
            .fillMaxSize()
            .padding(Spacing.screen),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        when (progress) {
            is VfxtRouteProgress.Done -> Icon(Icons.Filled.CheckCircle, null, tint = colors.success, modifier = Modifier.size(72.dp))
            is VfxtRouteProgress.Failed -> Icon(Icons.Outlined.ErrorOutline, null, tint = colors.error, modifier = Modifier.size(72.dp))
            else -> CircularProgressIndicator(color = colors.primary)
        }
        Spacer(Modifier.height(Spacing.lg))
        val title = when (progress) {
            null -> "Preparing…"
            is VfxtRouteProgress.Step -> if (progress.total > 1) "Step ${progress.step} of ${progress.total}: ${progress.label}" else progress.label
            is VfxtRouteProgress.Done -> "Swap complete"
            is VfxtRouteProgress.Failed -> "Swap didn't complete"
        }
        Text(title, style = MaterialTheme.typography.titleMedium, color = colors.textPrimary, textAlign = TextAlign.Center)
        if (progress is VfxtRouteProgress.Step && progress.hash != null) {
            Spacer(Modifier.height(Spacing.xs))
            Text("Waiting for confirmation…", style = MaterialTheme.typography.bodySmall, color = colors.textSecondary)
        }
        if (progress is VfxtRouteProgress.Done && route != null) {
            Spacer(Modifier.height(Spacing.sm))
            Text(
                "You received at least ${amount(route.amountOutMin, route.toToken.decimals)} ${route.toToken.symbol}.",
                style = MaterialTheme.typography.bodyMedium,
                color = colors.textSecondary,
                textAlign = TextAlign.Center,
            )
        }
        if (progress is VfxtRouteProgress.Failed) {
            Spacer(Modifier.height(Spacing.sm))
            Text(progress.message, style = MaterialTheme.typography.bodyMedium, color = colors.textSecondary, textAlign = TextAlign.Center)
        }
        val hash = when (progress) {
            is VfxtRouteProgress.Step -> progress.hash
            is VfxtRouteProgress.Done -> progress.hash
            is VfxtRouteProgress.Failed -> progress.hash
            null -> null
        }
        hash?.let {
            Spacer(Modifier.height(Spacing.sm))
            Text(
                "View on BscScan",
                style = MaterialTheme.typography.bodyMedium,
                color = colors.primary,
                modifier = Modifier.clickable { uri.openUri("https://bscscan.com/tx/$it") },
            )
        }
        if (finished) {
            Spacer(Modifier.height(Spacing.xl))
            VfxtPrimaryButton("Done", onDone, Modifier.fillMaxWidth())
            Spacer(Modifier.height(Spacing.sm))
            VfxtSecondaryButton("View activity", onActivity, Modifier.fillMaxWidth())
        } else {
            Spacer(Modifier.height(Spacing.lg))
            Text("Keep the app open until all steps finish.", style = MaterialTheme.typography.bodySmall, color = colors.textMuted)
        }
    }
}

@Composable
private fun Leg(label: String, symbol: String, logo: String?, value: String) {
    val colors = VfxtTheme.colors
    Text(label, style = MaterialTheme.typography.bodySmall, color = colors.textSecondary)
    Spacer(Modifier.height(Spacing.xs))
    Row(verticalAlignment = Alignment.CenterVertically) {
        TokenIcon(symbol, size = 32.dp, logoUrl = logo)
        Spacer(Modifier.width(Spacing.sm))
        Text("$value $symbol", style = MaterialTheme.typography.titleLarge, color = colors.textPrimary)
    }
}

@Composable
private fun Line(label: String, value: String) {
    Row(Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
        Text(label, style = MaterialTheme.typography.bodySmall, color = VfxtTheme.colors.textSecondary, modifier = Modifier.weight(1f))
        Text(value, style = MaterialTheme.typography.bodySmall, color = VfxtTheme.colors.textPrimary)
    }
}
