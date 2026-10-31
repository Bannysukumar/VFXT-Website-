package com.vfxt.wallet.core.designsystem.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.vfxt.wallet.core.designsystem.theme.VfxtPalette

/**
 * Locally drawn token glyphs. Remote logos are deliberately not loaded from token metadata:
 * arbitrary image URLs from untrusted token lists are a phishing vector. Verified logo assets
 * can be bundled per token later.
 */
@Composable
fun TokenIcon(
    symbol: String,
    modifier: Modifier = Modifier,
    size: Dp = 40.dp,
) {
    val upper = symbol.uppercase()
    val description = "$upper token"
    when (upper) {
        "VFXT" -> Box(
            modifier
                .size(size)
                .clip(CircleShape)
                .background(VfxtPalette.Midnight)
                .semantics { contentDescription = description },
            contentAlignment = Alignment.Center,
        ) { VfxtLogoMark(size = size * 0.62f) }

        "BNB", "TBNB" -> Box(
            modifier
                .size(size)
                .clip(CircleShape)
                .background(Color(0xFFF3BA2F))
                .semantics { contentDescription = description },
            contentAlignment = Alignment.Center,
        ) {
            // Five rotated squares forming a diamond cluster.
            Canvas(Modifier.size(size * 0.6f)) {
                val unit = this.size.minDimension
                val dark = Color(0xFF1E2026)
                fun diamond(cx: Float, cy: Float, side: Float) = rotate(45f, Offset(cx, cy)) {
                    drawRect(dark, Offset(cx - side / 2, cy - side / 2), Size(side, side))
                }
                val c = unit / 2
                diamond(c, c, unit * 0.22f)
                diamond(c, unit * 0.14f, unit * 0.16f)
                diamond(c, unit * 0.86f, unit * 0.16f)
                diamond(unit * 0.14f, c, unit * 0.16f)
                diamond(unit * 0.86f, c, unit * 0.16f)
            }
        }

        else -> {
            val (bg, glyph) = when (upper) {
                "USDT" -> Color(0xFF26A17B) to "₮"
                "USDC" -> Color(0xFF2775CA) to "$"
                "ETH" -> Color(0xFF627EEA) to "Ξ"
                else -> VfxtPalette.SlateRaised to upper.take(1)
            }
            Box(
                modifier
                    .size(size)
                    .clip(CircleShape)
                    .background(bg)
                    .semantics { contentDescription = description },
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    glyph,
                    style = TextStyle(
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        fontSize = (size.value * 0.45f).sp,
                    ),
                )
            }
        }
    }
}
