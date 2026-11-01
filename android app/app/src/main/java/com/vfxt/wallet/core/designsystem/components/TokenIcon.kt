package com.vfxt.wallet.core.designsystem.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import com.vfxt.wallet.blockchain.networks.EvmNetwork
import com.vfxt.wallet.core.common.TokenLogos
import com.vfxt.wallet.core.designsystem.theme.VfxtPalette

/**
 * Token / coin icon. Shows the real logo when [logoUrl] is on a trusted host
 * (see [TokenLogos.trusted]); otherwise, or while loading / on failure, a locally drawn glyph.
 * VFXT always uses the in-house brand mark.
 */
@Composable
fun TokenIcon(
    symbol: String,
    modifier: Modifier = Modifier,
    size: Dp = 40.dp,
    logoUrl: String? = null,
) {
    val upper = symbol.uppercase()
    val url = if (upper == "VFXT") null else TokenLogos.trusted(logoUrl)
    var failed by remember(url) { mutableStateOf(false) }
    Box(
        modifier
            .size(size)
            .clip(CircleShape)
            .semantics { contentDescription = "$upper logo" },
        contentAlignment = Alignment.Center,
    ) {
        // Glyph underneath doubles as the loading / error placeholder.
        GlyphIcon(upper, size)
        if (url != null && !failed) {
            AsyncImage(
                model = url,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                onError = { failed = true },
                modifier = Modifier
                    .fillMaxSize()
                    .clip(CircleShape)
                    .background(Color.White),
            )
        }
    }
}

/** Network logo (its native coin's artwork). Custom networks without artwork get a glyph. */
@Composable
fun NetworkIcon(network: EvmNetwork, modifier: Modifier = Modifier, size: Dp = 32.dp) {
    TokenIcon(
        symbol = network.nativeSymbol.removePrefix("t"),
        modifier = modifier,
        size = size,
        logoUrl = if (network.isCustom) null else TokenLogos.network(network.chainId),
    )
}

@Composable
private fun GlyphIcon(upper: String, size: Dp) {
    when (upper) {
        "VFXT" -> Box(
            Modifier.size(size).clip(CircleShape).background(VfxtPalette.Midnight),
            contentAlignment = Alignment.Center,
        ) { VfxtLogoMark(size = size * 0.62f) }

        "BNB", "TBNB" -> Box(
            Modifier.size(size).clip(CircleShape).background(Color(0xFFF3BA2F)),
            contentAlignment = Alignment.Center,
        ) {
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
                "ETH", "WETH" -> Color(0xFF627EEA) to "Ξ"
                "POL", "MATIC" -> Color(0xFF8247E5) to "P"
                "AVAX" -> Color(0xFFE84142) to "A"
                else -> VfxtPalette.SlateRaised to upper.take(1)
            }
            Box(
                Modifier.size(size).clip(CircleShape).background(bg),
                contentAlignment = Alignment.Center,
            ) {
                Text(glyph, style = TextStyle(color = Color.White, fontWeight = FontWeight.Bold, fontSize = (size.value * 0.45f).sp))
            }
        }
    }
}
