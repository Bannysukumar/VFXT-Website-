package com.vfxt.wallet.core.designsystem.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Backspace
import androidx.compose.material.icons.outlined.Fingerprint
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import com.vfxt.wallet.core.designsystem.theme.Spacing
import com.vfxt.wallet.core.designsystem.theme.VfxtTheme
import kotlin.math.roundToInt

/** Row of dots showing how many PIN digits have been entered. Shakes when [errorKey] changes. */
@Composable
fun PinDots(
    filled: Int,
    length: Int,
    modifier: Modifier = Modifier,
    isError: Boolean = false,
    errorKey: Int = 0,
) {
    val colors = VfxtTheme.colors
    val shake = remember { Animatable(0f) }
    LaunchedEffect(errorKey) {
        if (errorKey == 0) return@LaunchedEffect
        for (x in listOf(-14f, 12f, -9f, 6f, -3f, 0f)) shake.animateTo(x, spring(stiffness = 4000f))
    }
    Row(
        modifier
            .offset { IntOffset(shake.value.dp.roundToPx(), 0) }
            .semantics { contentDescription = "$filled of $length digits entered" },
        horizontalArrangement = Arrangement.spacedBy(Spacing.lg),
    ) {
        repeat(length) { i ->
            val target = when {
                isError -> colors.error
                i < filled -> colors.primary
                else -> colors.cardRaised
            }
            val color by animateColorAsState(target, label = "pinDot")
            Box(
                Modifier
                    .size(16.dp)
                    .clip(CircleShape)
                    .background(color)
                    .border(1.dp, if (i < filled || isError) color else colors.border, CircleShape),
            )
        }
    }
}

/**
 * Numeric keypad. The PIN buffer lives in the caller as a CharArray-friendly String of digits;
 * digits are never logged and the pad uses no system keyboard (no IME learning or clipboard).
 */
@Composable
fun PinPad(
    onDigit: (Char) -> Unit,
    onBackspace: () -> Unit,
    modifier: Modifier = Modifier,
    onBiometric: (() -> Unit)? = null,
    enabled: Boolean = true,
) {
    val haptics = LocalHapticFeedback.current
    val rows = listOf(listOf('1', '2', '3'), listOf('4', '5', '6'), listOf('7', '8', '9'))
    Column(modifier, verticalArrangement = Arrangement.spacedBy(Spacing.md), horizontalAlignment = Alignment.CenterHorizontally) {
        rows.forEach { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.xxl)) {
                row.forEach { d ->
                    PadKey(label = d.toString(), enabled = enabled) {
                        haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                        onDigit(d)
                    }
                }
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.xxl), verticalAlignment = Alignment.CenterVertically) {
            if (onBiometric != null) {
                PadIconKey(Icons.Outlined.Fingerprint, "Use biometrics", enabled, onBiometric)
            } else {
                Box(Modifier.width(72.dp))
            }
            PadKey("0", enabled = enabled) {
                haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                onDigit('0')
            }
            PadIconKey(Icons.AutoMirrored.Outlined.Backspace, "Delete", enabled, onBackspace)
        }
    }
}

@Composable
private fun PadKey(label: String, enabled: Boolean, onClick: () -> Unit) {
    val colors = VfxtTheme.colors
    Box(
        Modifier
            .size(72.dp)
            .clip(CircleShape)
            .background(colors.card)
            .border(1.dp, colors.border, CircleShape)
            .clickable(enabled = enabled, role = Role.Button, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(label, style = MaterialTheme.typography.headlineMedium, color = colors.textPrimary)
    }
}

@Composable
private fun PadIconKey(icon: androidx.compose.ui.graphics.vector.ImageVector, description: String, enabled: Boolean, onClick: () -> Unit) {
    val colors = VfxtTheme.colors
    Box(
        Modifier
            .size(72.dp)
            .clip(CircleShape)
            .clickable(enabled = enabled, role = Role.Button, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(icon, contentDescription = description, tint = colors.textSecondary, modifier = Modifier.size(28.dp))
    }
}

/** Formats a lockout end time as a short countdown label. */
fun lockoutLabel(untilMillis: Long, now: Long): String {
    val seconds = ((untilMillis - now) / 1000.0).roundToInt().coerceAtLeast(0)
    return if (seconds >= 60) "Try again in ${seconds / 60}m ${seconds % 60}s" else "Try again in ${seconds}s"
}
