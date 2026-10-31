package com.vfxt.wallet.core.designsystem.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import com.vfxt.wallet.core.designsystem.theme.VfxtPalette
import com.vfxt.wallet.core.designsystem.theme.VfxtTheme

/**
 * The VFXT "V" mark. Geometry matches res/drawable/ic_launcher_foreground.xml
 * (viewport region x 33..75, y 37..73.5) so the in-app logo and launcher icon are identical.
 *
 * @param reveal 0..1 animates each stroke growing from the top; 1 draws the full mark.
 */
@Composable
fun VfxtLogoMark(
    modifier: Modifier = Modifier,
    size: Dp = 32.dp,
    reveal: Float = 1f,
) {
    Canvas(modifier.size(size)) { drawLogoMark(reveal.coerceIn(0f, 1f)) }
}

private const val MARK_MIN_X = 33f
private const val MARK_MIN_Y = 37f
private const val MARK_EXTENT = 42f

private fun DrawScope.drawLogoMark(reveal: Float) {
    val scale = size.minDimension / MARK_EXTENT
    // Center the 42 x 36.5 mark vertically inside the square canvas.
    val yOffset = (size.height - 36.5f * scale) / 2f
    fun p(x: Float, y: Float) = Offset((x - MARK_MIN_X) * scale, (y - MARK_MIN_Y) * scale + yOffset)

    val clipBottom = MARK_MIN_Y + 36.5f * reveal

    val left = Path().apply {
        moveTo(p(33f, 37f).x, p(33f, 37f).y)
        lineTo(p(44f, 37f).x, p(44f, 37f).y)
        lineTo(p(57f, 71f).x, p(57f, 71f).y)
        lineTo(p(50.5f, 73f).x, p(50.5f, 73f).y)
        quadraticTo(p(48.5f, 73.5f).x, p(48.5f, 73.5f).y, p(47.5f, 71f).x, p(47.5f, 71f).y)
        close()
    }
    val right = Path().apply {
        moveTo(p(75f, 37f).x, p(75f, 37f).y)
        lineTo(p(64f, 37f).x, p(64f, 37f).y)
        lineTo(p(52.5f, 67f).x, p(52.5f, 67f).y)
        lineTo(p(56.5f, 73f).x, p(56.5f, 73f).y)
        quadraticTo(p(58.5f, 73.5f).x, p(58.5f, 73.5f).y, p(59.5f, 71f).x, p(59.5f, 71f).y)
        close()
    }

    val clip = p(0f, clipBottom).y
    drawContext.canvas.save()
    drawContext.canvas.clipRect(0f, 0f, size.width, clip)
    drawPath(
        right,
        Brush.linearGradient(listOf(VfxtPalette.Purple, VfxtPalette.Blue), p(75f, 37f), p(55f, 73f)),
    )
    drawPath(
        left,
        Brush.linearGradient(listOf(VfxtPalette.Electric, VfxtPalette.Blue), p(33f, 37f), p(54f, 73f)),
    )
    drawContext.canvas.restore()
}

/** Logo mark followed by the "VFXT" wordmark. */
@Composable
fun VfxtWordmark(
    modifier: Modifier = Modifier,
    markSize: Dp = 28.dp,
    showWallet: Boolean = false,
) {
    val colors = VfxtTheme.colors
    Row(modifier, verticalAlignment = Alignment.CenterVertically) {
        VfxtLogoMark(size = markSize)
        Spacer(Modifier.width(8.dp))
        Text(
            text = "VFXT",
            style = TextStyle(
                fontSize = (markSize.value * 0.68f).sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.04.em,
                color = colors.textPrimary,
            ),
        )
        if (showWallet) {
            Text(
                text = " Wallet",
                style = TextStyle(
                    fontSize = (markSize.value * 0.68f).sp,
                    fontWeight = FontWeight.Normal,
                    color = colors.textSecondary,
                ),
            )
        }
    }
}
