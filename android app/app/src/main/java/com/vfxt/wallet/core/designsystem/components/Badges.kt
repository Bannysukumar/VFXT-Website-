package com.vfxt.wallet.core.designsystem.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.vfxt.wallet.core.designsystem.theme.VfxtTheme

enum class PillTone { Neutral, Primary, Success, Error, Warning, Accent }

@Composable
private fun PillTone.color(): Color {
    val c = VfxtTheme.colors
    return when (this) {
        PillTone.Neutral -> c.textSecondary
        PillTone.Primary -> c.primary
        PillTone.Success -> c.success
        PillTone.Error -> c.error
        PillTone.Warning -> c.warning
        PillTone.Accent -> c.accent
    }
}

/** Small tinted label, e.g. transaction status or network name. */
@Composable
fun StatusPill(
    text: String,
    modifier: Modifier = Modifier,
    tone: PillTone = PillTone.Neutral,
    showDot: Boolean = false,
) {
    val color = tone.color()
    Row(
        modifier = modifier
            .clip(RoundedCornerShape(50))
            .background(color.copy(alpha = 0.14f))
            .padding(horizontal = 8.dp, vertical = 3.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (showDot) {
            Spacer(Modifier.size(6.dp).clip(CircleShape).background(color))
            Spacer(Modifier.width(5.dp))
        }
        Text(text, style = MaterialTheme.typography.labelMedium, color = color, maxLines = 1)
    }
}

/** Mandatory marker on every piece of simulated trading data. */
@Composable
fun DemoBadge(modifier: Modifier = Modifier) {
    StatusPill("DEMO", modifier, tone = PillTone.Warning)
}

/** Marks features that are visible but not yet available. */
@Composable
fun SoonBadge(modifier: Modifier = Modifier) {
    Text(
        text = "SOON",
        style = MaterialTheme.typography.labelSmall,
        color = Color.White,
        modifier = modifier
            .clip(RoundedCornerShape(50))
            .background(VfxtTheme.colors.accent)
            .padding(horizontal = 6.dp, vertical = 2.dp),
    )
}
