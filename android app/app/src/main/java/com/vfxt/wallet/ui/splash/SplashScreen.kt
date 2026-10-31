package com.vfxt.wallet.ui.splash

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import com.vfxt.wallet.core.designsystem.components.VfxtLogoMark
import com.vfxt.wallet.core.designsystem.theme.VfxtTheme
import androidx.compose.runtime.snapshotFlow
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

/**
 * Animated brand splash. The mark draws in, the wordmark rises, then the screen hands off
 * once both the animation has finished and [isReady] is true.
 */
@Composable
fun SplashScreen(isReady: Boolean, onFinished: () -> Unit) {
    val colors = VfxtTheme.colors
    val reveal = remember { Animatable(0f) }
    val markScale = remember { Animatable(0.82f) }
    val textAlpha = remember { Animatable(0f) }
    val textOffset = remember { Animatable(16f) }
    val currentReady by rememberUpdatedState(isReady)
    val currentOnFinished by rememberUpdatedState(onFinished)

    LaunchedEffect(Unit) {
        coroutineScope {
            launch { markScale.animateTo(1f, tween(900, easing = FastOutSlowInEasing)) }
            reveal.animateTo(1f, tween(800, easing = FastOutSlowInEasing))
            launch { textOffset.animateTo(0f, tween(500, easing = FastOutSlowInEasing)) }
            textAlpha.animateTo(1f, tween(500))
        }
        delay(450)
        snapshotFlow { currentReady }.first { it }
        currentOnFinished()
    }

    val glow = rememberInfiniteTransition(label = "glow")
    val pulse by glow.animateFloat(
        initialValue = 0.85f,
        targetValue = 1.1f,
        animationSpec = infiniteRepeatable(tween(1800, easing = LinearEasing), RepeatMode.Reverse),
        label = "pulse",
    )

    Box(
        Modifier
            .fillMaxSize()
            .background(colors.background),
        contentAlignment = Alignment.Center,
    ) {
        // Soft halo + orbit ring behind the mark.
        Canvas(Modifier.size(320.dp)) {
            drawCircle(
                brush = Brush.radialGradient(
                    listOf(colors.primary.copy(alpha = 0.32f * reveal.value), colors.background.copy(alpha = 0f)),
                    radius = size.minDimension / 2 * pulse,
                ),
                radius = size.minDimension / 2,
            )
            drawCircle(
                color = colors.electric.copy(alpha = 0.18f * reveal.value),
                radius = size.minDimension * 0.30f,
                style = Stroke(width = 1.dp.toPx()),
            )
        }

        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            VfxtLogoMark(
                size = 112.dp,
                reveal = reveal.value,
                modifier = Modifier.graphicsLayer {
                    scaleX = markScale.value
                    scaleY = markScale.value
                },
            )
            Spacer(Modifier.height(28.dp))
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(6.dp),
                modifier = Modifier.graphicsLayer {
                    alpha = textAlpha.value
                    translationY = textOffset.value * density
                },
            ) {
                Text(
                    "VFXT WALLET",
                    style = MaterialTheme.typography.headlineSmall.copy(
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 0.24.em,
                    ),
                    color = colors.textPrimary,
                )
                Text(
                    "Your keys. Your crypto.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = colors.textSecondary,
                )
            }
        }

        Text(
            "Self-custody · BNB Smart Chain",
            style = MaterialTheme.typography.labelMedium,
            color = colors.textMuted,
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .navigationBarsPadding()
                .padding(bottom = 28.dp)
                .graphicsLayer { alpha = textAlpha.value },
        )
    }
}

@Preview
@Composable
private fun SplashPreview() {
    VfxtTheme { SplashScreen(isReady = false, onFinished = {}) }
}
