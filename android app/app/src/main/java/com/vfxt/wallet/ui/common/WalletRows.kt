package com.vfxt.wallet.ui.common

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.CallMade
import androidx.compose.material.icons.automirrored.filled.CallReceived
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.Redeem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.vfxt.wallet.blockchain.networks.Networks
import com.vfxt.wallet.core.common.Formatters
import com.vfxt.wallet.core.common.HIDDEN_BALANCE
import com.vfxt.wallet.core.designsystem.components.IconTile
import com.vfxt.wallet.core.designsystem.components.PillTone
import com.vfxt.wallet.core.designsystem.components.StatusPill
import com.vfxt.wallet.core.designsystem.components.TokenIcon
import com.vfxt.wallet.core.designsystem.theme.AmountTextStyle
import com.vfxt.wallet.core.designsystem.theme.Spacing
import com.vfxt.wallet.core.designsystem.theme.VfxtTheme
import com.vfxt.wallet.domain.models.ActivityItem
import com.vfxt.wallet.domain.models.ActivityStatus
import com.vfxt.wallet.domain.models.ActivityType
import com.vfxt.wallet.domain.models.Holding
import java.text.DateFormat
import java.util.Date

fun networkShortName(networkId: String): String =
    Networks.all.firstOrNull { it.id == networkId }?.shortName
        ?: networkId.removePrefix("custom-").take(12).ifBlank { networkId }

/** Token position row. Live unit price + 24h change under the name (Trust/MetaMask style). */
@Composable
fun AssetRow(
    holding: Holding,
    hideBalance: Boolean,
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
) {
    val colors = VfxtTheme.colors
    val token = holding.token
    Row(
        modifier
            .fillMaxWidth()
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier)
            .padding(horizontal = Spacing.md, vertical = Spacing.md),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        TokenIcon(token.symbol, size = 40.dp)
        Spacer(Modifier.width(Spacing.md))
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(token.symbol, style = MaterialTheme.typography.titleSmall, color = colors.textPrimary)
                Spacer(Modifier.width(6.dp))
                StatusPill(networkShortName(token.networkId))
            }
            val unit = holding.unitPrice
            val change = holding.change24hPercent
            when {
                unit != null -> Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        Formatters.unitPrice(unit),
                        style = MaterialTheme.typography.bodySmall,
                        color = colors.textSecondary,
                    )
                    change?.let {
                        Spacer(Modifier.width(6.dp))
                        Text(
                            Formatters.percent(it),
                            style = MaterialTheme.typography.bodySmall,
                            color = if (it.signum() >= 0) colors.success else colors.error,
                        )
                    }
                }
                else -> Text(token.name, style = MaterialTheme.typography.bodySmall, color = colors.textSecondary)
            }
        }
        Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(3.dp)) {
            val raw = holding.rawBalance
            when {
                !token.isAvailable -> Text("Not deployed yet", style = MaterialTheme.typography.bodySmall, color = colors.textMuted)
                raw == null -> Text("Not synced", style = MaterialTheme.typography.bodySmall, color = colors.textMuted)
                hideBalance -> Text(HIDDEN_BALANCE, style = AmountTextStyle, color = colors.textPrimary)
                else -> Text(Formatters.tokenAmount(raw, token.decimals), style = AmountTextStyle, color = colors.textPrimary)
            }
            holding.fiatValue?.let {
                Text(
                    if (hideBalance) HIDDEN_BALANCE else Formatters.fiat(it),
                    style = MaterialTheme.typography.bodySmall,
                    color = colors.textSecondary,
                )
            }
        }
    }
}

@Composable
fun ActivityRow(item: ActivityItem, modifier: Modifier = Modifier, onClick: (() -> Unit)? = null) {
    val colors = VfxtTheme.colors
    val (icon, tint, title) = when (item.type) {
        ActivityType.Received -> Triple(Icons.AutoMirrored.Filled.CallReceived, colors.success, "Received")
        ActivityType.Sent -> Triple(Icons.AutoMirrored.Filled.CallMade, colors.primary, "Sent")
        ActivityType.MiningReward -> Triple(Icons.Filled.Bolt, colors.electric, "Mining reward")
        ActivityType.Claim -> Triple(Icons.Filled.Redeem, colors.accent, "Reward claim")
    }
    val (statusText, statusTone) = when (item.status) {
        ActivityStatus.Pending -> "Pending" to PillTone.Warning
        ActivityStatus.Confirmed -> "Confirmed" to PillTone.Success
        ActivityStatus.Failed -> "Failed" to PillTone.Error
    }
    val sign = if (item.type == ActivityType.Sent) "−" else "+"
    Row(
        modifier
            .fillMaxWidth()
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier)
            .padding(horizontal = Spacing.md, vertical = Spacing.md),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        IconTile(icon, tint, size = 40.dp)
        Spacer(Modifier.width(Spacing.md))
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(title, style = MaterialTheme.typography.titleSmall, color = colors.textPrimary)
            Text(
                DateFormat.getDateTimeInstance(DateFormat.MEDIUM, DateFormat.SHORT).format(Date(item.timestampMillis)) +
                    (item.txHash?.let { " · ${Formatters.shortAddress(it)}" } ?: ""),
                style = MaterialTheme.typography.bodySmall,
                color = colors.textSecondary,
            )
        }
        Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(
                "$sign${Formatters.tokenAmount(item.amount)} ${item.tokenSymbol}",
                style = AmountTextStyle,
                color = if (item.type == ActivityType.Sent) colors.textPrimary else colors.success,
            )
            StatusPill(statusText, tone = statusTone)
        }
    }
}
