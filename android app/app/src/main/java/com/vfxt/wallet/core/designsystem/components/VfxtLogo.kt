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
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathMeasure
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import com.vfxt.wallet.core.designsystem.theme.VfxtTheme

/** Brand colours of the chart mark (identical to the website favicon / logo.tsx). */
object VfxtMarkColors {
    val Tile = Color(0xFF0A1915)
    val Line = Color(0xFF34D399)
    val Dot = Color(0xFFC6F56F)
}

/**
 * The VFXT chart mark: a dark rounded tile with a green chart line and a lime dot. Drawn from the
 * website's 32x32 SVG (src/components/shared/logo.tsx, public/favicon.svg) and matching
 * res/drawable/ic_launcher_foreground.xml, so the app, launcher icon and site share one logo.
 *
 * @param reveal 0..1 draws the chart line from left to right, then pops in the dot; 1 = full mark.
 * @param showTile false draws only the line and dot (for use on an already-dark circle).
 */
@Composable
fun VfxtLogoMark(
    modifier: Modifier = Modifier,
    size: Dp = 32.dp,
    reveal: Float = 1f,
    showTile: Boolean = true,
) {
    Canvas(modifier.size(size)) { drawLogoMark(reveal.coerceIn(0f, 1f), showTile) }
}

private const val VIEWBOX = 32f

/** Chart polyline from the SVG: M7.5 21.5 13 11 l4.5 7.5 3-5 4 8. */
private val LINE_POINTS = listOf(7.5f to 21.5f, 13f to 11f, 17.5f to 18.5f, 20.5f to 13.5f, 24.5f to 21.5f)

private fun DrawScope.drawLogoMark(reveal: Float, showTile: Boolean) {
    val s = size.minDimension / VIEWBOX
    fun p(x: Float, y: Float) = Offset(x * s, y * s)

    if (showTile) {
        drawRoundRect(VfxtMarkColors.Tile, cornerRadius = CornerRadius(8f * s, 8f * s))
    }

    val full = Path().apply {
        val (x0, y0) = LINE_POINTS.first()
        moveTo(p(x0, y0).x, p(x0, y0).y)
        LINE_POINTS.drop(1).forEach { (x, y) -> lineTo(p(x, y).x, p(x, y).y) }
    }
    val lineProgress = (reveal / 0.85f).coerceAtMost(1f)
    val line = if (lineProgress >= 1f) {
        full
    } else {
        val measure = PathMeasure().apply { setPath(full, false) }
        Path().also { measure.getSegment(0f, measure.length * lineProgress, it, true) }
    }
    drawPath(line, VfxtMarkColors.Line, style = Stroke(width = 2.6f * s, cap = StrokeCap.Round, join = StrokeJoin.Round))

    val dot = ((reveal - 0.85f) / 0.15f).coerceIn(0f, 1f)
    if (dot > 0f) drawCircle(VfxtMarkColors.Dot, radius = 2f * s * dot, center = p(24.5f, 10f))
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
