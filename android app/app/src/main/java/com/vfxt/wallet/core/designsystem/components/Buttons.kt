package com.vfxt.wallet.core.designsystem.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import com.vfxt.wallet.core.designsystem.theme.VfxtTheme

private val ButtonHeight = 54.dp
private val ButtonShape = RoundedCornerShape(16.dp)

/** Shared press feedback: a subtle scale-down instead of a ripple flash. */
@Composable
private fun pressScale(interaction: MutableInteractionSource): Float {
    val pressed by interaction.collectIsPressedAsState()
    return if (pressed) 0.98f else 1f
}

@Composable
private fun ButtonContent(text: String, icon: ImageVector?, loading: Boolean, contentColor: Color) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.Center) {
        if (loading) {
            CircularProgressIndicator(Modifier.size(20.dp), color = contentColor, strokeWidth = 2.dp)
        } else {
            if (icon != null) {
                Icon(icon, contentDescription = null, tint = contentColor, modifier = Modifier.size(20.dp))
                Spacer(Modifier.width(8.dp))
            }
            Text(text, style = MaterialTheme.typography.labelLarge, color = contentColor)
        }
    }
}

@Composable
private fun BaseButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier,
    enabled: Boolean,
    loading: Boolean,
    icon: ImageVector?,
    background: Brush,
    border: BorderStroke?,
    contentColor: Color,
) {
    val interaction = remember { MutableInteractionSource() }
    Box(
        modifier = modifier
            .height(ButtonHeight)
            .scale(pressScale(interaction))
            .alpha(if (enabled) 1f else 0.45f)
            .clip(ButtonShape)
            .background(background)
            .then(if (border != null) Modifier.border(border, ButtonShape) else Modifier)
            .clickable(
                interactionSource = interaction,
                indication = androidx.compose.material3.ripple(color = contentColor),
                enabled = enabled && !loading,
                role = Role.Button,
                onClick = onClick,
            )
            .padding(horizontal = 20.dp),
        contentAlignment = Alignment.Center,
    ) {
        ButtonContent(text, icon, loading, contentColor)
    }
}

/** Gradient call-to-action. Use at most one per screen; pass `Modifier.fillMaxWidth()` for full-width. */
@Composable
fun VfxtPrimaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    loading: Boolean = false,
    icon: ImageVector? = null,
) {
    val colors = VfxtTheme.colors
    BaseButton(
        text, onClick, modifier, enabled, loading, icon,
        background = colors.brandGradient,
        border = null,
        contentColor = colors.onPrimary,
    )
}

@Composable
fun VfxtSecondaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    icon: ImageVector? = null,
) {
    val colors = VfxtTheme.colors
    BaseButton(
        text, onClick, modifier, enabled, loading = false, icon = icon,
        background = SolidColor(colors.card),
        border = BorderStroke(1.dp, colors.border),
        contentColor = colors.textPrimary,
    )
}

/** Solid-tone button for buy/sell style actions. */
@Composable
fun VfxtToneButton(
    text: String,
    tone: Color,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) {
    BaseButton(
        text, onClick, modifier, enabled, loading = false, icon = null,
        background = SolidColor(tone),
        border = null,
        contentColor = Color.White,
    )
}

@Composable
fun VfxtTextButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    color: Color = VfxtTheme.colors.primary,
) {
    Text(
        text = text,
        style = MaterialTheme.typography.labelLarge,
        color = color,
        modifier = modifier
            .clip(RoundedCornerShape(8.dp))
            .clickable(role = Role.Button, onClick = onClick)
            .padding(horizontal = 8.dp, vertical = 6.dp),
    )
}

/** Circular icon button on a card-colored background, used in top bars. */
@Composable
fun VfxtIconButton(
    icon: ImageVector,
    contentDescription: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    showDot: Boolean = false,
) {
    val colors = VfxtTheme.colors
    Box(
        modifier = modifier
            .size(42.dp)
            .clip(RoundedCornerShape(14.dp))
            .background(colors.card)
            .border(1.dp, colors.border, RoundedCornerShape(14.dp))
            .clickable(role = Role.Button, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(icon, contentDescription, tint = colors.textPrimary, modifier = Modifier.size(20.dp))
        if (showDot) {
            Box(
                Modifier
                    .align(Alignment.TopEnd)
                    .padding(10.dp)
                    .size(7.dp)
                    .clip(RoundedCornerShape(50))
                    .background(colors.error),
            )
        }
    }
}
