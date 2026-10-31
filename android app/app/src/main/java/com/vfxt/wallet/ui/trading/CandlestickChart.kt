package com.vfxt.wallet.ui.trading

import androidx.compose.foundation.Canvas
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.vfxt.wallet.core.designsystem.theme.VfxtTheme
import com.vfxt.wallet.data.demo.DemoCandle
import java.util.Locale

/** Lightweight Canvas candlestick chart with a price axis and last-price line. */
@Composable
fun CandlestickChart(
    candles: List<DemoCandle>,
    modifier: Modifier = Modifier,
) {
    val colors = VfxtTheme.colors
    val measurer = rememberTextMeasurer()
    val axisStyle = TextStyle(color = colors.textMuted, fontSize = 10.sp)
    val watermarkStyle = TextStyle(color = colors.textMuted.copy(alpha = 0.18f), fontSize = 28.sp)

    Canvas(modifier.semantics { contentDescription = "Demo price chart" }) {
        if (candles.isEmpty()) return@Canvas
        val axisWidth = 52.dp.toPx()
        val chartWidth = size.width - axisWidth
        val maxPrice = candles.maxOf { it.high }
        val minPrice = candles.minOf { it.low }
        val range = (maxPrice - minPrice).takeIf { it > 0 } ?: 1.0
        val padY = size.height * 0.06f
        fun y(price: Double) = (padY + (maxPrice - price) / range * (size.height - padY * 2)).toFloat()

        // Watermark: the chart must never be mistaken for a live market.
        val wm = measurer.measure("DEMO DATA", watermarkStyle)
        drawText(wm, topLeft = Offset((chartWidth - wm.size.width) / 2, (size.height - wm.size.height) / 2))

        // Grid + price labels.
        val gridLines = 4
        for (i in 0..gridLines) {
            val price = maxPrice - range * i / gridLines
            val gy = y(price)
            drawLine(colors.border.copy(alpha = 0.5f), Offset(0f, gy), Offset(chartWidth, gy), strokeWidth = 1f)
            val label = measurer.measure(formatPrice(price), axisStyle)
            drawText(label, topLeft = Offset(chartWidth + 6.dp.toPx(), gy - label.size.height / 2))
        }

        val slot = chartWidth / candles.size
        val bodyWidth = (slot * 0.62f).coerceAtLeast(2f)
        candles.forEachIndexed { i, c ->
            val cx = slot * i + slot / 2
            val up = c.close >= c.open
            val color = if (up) colors.success else colors.error
            drawLine(color, Offset(cx, y(c.high)), Offset(cx, y(c.low)), strokeWidth = 1.2.dp.toPx())
            val top = y(maxOf(c.open, c.close))
            val bottom = y(minOf(c.open, c.close))
            drawRect(color, Offset(cx - bodyWidth / 2, top), Size(bodyWidth, (bottom - top).coerceAtLeast(1.5f)))
        }

        // Last price marker.
        val last = candles.last()
        val ly = y(last.close)
        val lastColor = if (last.close >= last.open) colors.success else colors.error
        drawLine(
            lastColor.copy(alpha = 0.8f), Offset(0f, ly), Offset(chartWidth, ly),
            strokeWidth = 1.dp.toPx(), pathEffect = PathEffect.dashPathEffect(floatArrayOf(8f, 8f)),
        )
        val tag = measurer.measure(formatPrice(last.close), axisStyle.copy(color = colors.onPrimary))
        drawRect(
            lastColor,
            Offset(chartWidth + 2.dp.toPx(), ly - tag.size.height / 2 - 2.dp.toPx()),
            Size(axisWidth - 2.dp.toPx(), tag.size.height + 4.dp.toPx()),
        )
        drawText(tag, topLeft = Offset(chartWidth + 6.dp.toPx(), ly - tag.size.height / 2))
    }
}

internal fun formatPrice(price: Double): String = String.format(Locale.US, "%.5f", price)
