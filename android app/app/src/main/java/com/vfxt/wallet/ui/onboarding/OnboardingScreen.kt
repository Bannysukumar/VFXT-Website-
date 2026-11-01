package com.vfxt.wallet.ui.onboarding

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.Fingerprint
import androidx.compose.material.icons.filled.Key
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.vfxt.wallet.core.designsystem.components.TokenIcon
import com.vfxt.wallet.core.common.TokenLogos
import com.vfxt.wallet.core.designsystem.components.VfxtLogoMark
import com.vfxt.wallet.core.designsystem.components.VfxtPrimaryButton
import com.vfxt.wallet.core.designsystem.components.VfxtSecondaryButton
import com.vfxt.wallet.core.designsystem.components.VfxtTextButton
import com.vfxt.wallet.core.designsystem.components.VfxtWordmark
import com.vfxt.wallet.core.designsystem.theme.Spacing
import com.vfxt.wallet.core.designsystem.theme.VfxtTheme
import kotlinx.coroutines.launch
import kotlin.math.absoluteValue

private data class OnboardingPage(val title: String, val body: String)

private val pages = listOf(
    OnboardingPage(
        "Welcome to VFXT Wallet",
        "A self-custody wallet built for BNB Smart Chain and the VFXT ecosystem.",
    ),
    OnboardingPage(
        "Securely manage your crypto",
        "Your recovery phrase and private keys are encrypted on this device and never leave it.",
    ),
    OnboardingPage(
        "Discover VFXT mining",
        "Start mining sessions, track rewards in real time and claim VFXT to your wallet.",
    ),
    OnboardingPage(
        "All your assets in one place",
        "Send, receive and track BNB, USDT, VFXT and other BEP-20 tokens.",
    ),
)

@Composable
fun OnboardingScreen(
    onCreateWallet: () -> Unit,
    onImportWallet: () -> Unit,
    onSkip: () -> Unit,
) {
    val colors = VfxtTheme.colors
    val pagerState = rememberPagerState { pages.size }
    val scope = rememberCoroutineScope()
    val isLast = pagerState.currentPage == pages.lastIndex

    Column(
        Modifier
            .fillMaxSize()
            .background(colors.background)
            .safeDrawingPadding(),
    ) {
        Row(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.screen, vertical = Spacing.md),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            VfxtWordmark(markSize = 26.dp)
            if (!isLast) VfxtTextButton("Skip", onSkip, color = colors.textSecondary)
        }

        HorizontalPager(
            state = pagerState,
            modifier = Modifier.weight(1f),
        ) { index ->
            Column(
                Modifier
                    .fillMaxSize()
                    .padding(horizontal = Spacing.xxl)
                    .graphicsLayer {
                        // Parallax: read the swipe offset in the draw phase to avoid recomposing per frame.
                        val pageOffset =
                            (pagerState.currentPage - index + pagerState.currentPageOffsetFraction).absoluteValue
                        alpha = 1f - pageOffset.coerceIn(0f, 1f) * 0.6f
                        translationX = pageOffset * 40f
                    },
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                Box(Modifier.size(280.dp), contentAlignment = Alignment.Center) {
                    when (index) {
                        0 -> WelcomeIllustration()
                        1 -> SecurityIllustration()
                        2 -> MiningIllustration()
                        else -> AssetsIllustration()
                    }
                }
                Spacer(Modifier.height(Spacing.xxxl))
                Text(
                    pages[index].title,
                    style = MaterialTheme.typography.headlineMedium,
                    color = colors.textPrimary,
                    textAlign = TextAlign.Center,
                )
                Spacer(Modifier.height(Spacing.md))
                Text(
                    pages[index].body,
                    style = MaterialTheme.typography.bodyLarge,
                    color = colors.textSecondary,
                    textAlign = TextAlign.Center,
                )
            }
        }

        PageIndicator(count = pages.size, current = pagerState.currentPage, modifier = Modifier.align(Alignment.CenterHorizontally))
        Spacer(Modifier.height(Spacing.xxl))

        AnimatedContent(
            targetState = isLast,
            transitionSpec = { fadeIn(tween(250)) togetherWith fadeOut(tween(150)) },
            label = "onboardingActions",
            modifier = Modifier.padding(horizontal = Spacing.screen),
        ) { last ->
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.md)) {
                if (last) {
                    VfxtPrimaryButton("Create a new wallet", onCreateWallet, Modifier.fillMaxWidth())
                    VfxtSecondaryButton("Import existing wallet", onImportWallet, Modifier.fillMaxWidth())
                } else {
                    VfxtPrimaryButton(
                        text = if (pagerState.currentPage == 0) "Get Started" else "Continue",
                        onClick = { scope.launch { pagerState.animateScrollToPage(pagerState.currentPage + 1) } },
                        modifier = Modifier.fillMaxWidth(),
                    )
                    // Keeps the button block the same height on every page.
                    Spacer(Modifier.height(54.dp))
                }
            }
        }
        Spacer(Modifier.height(Spacing.lg))
    }
}

@Composable
private fun PageIndicator(count: Int, current: Int, modifier: Modifier = Modifier) {
    Row(modifier, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        repeat(count) { i ->
            val selected = i == current
            val width by animateDpAsState(if (selected) 24.dp else 8.dp, label = "dotWidth")
            val color by animateColorAsState(
                if (selected) VfxtTheme.colors.primary else VfxtTheme.colors.border,
                label = "dotColor",
            )
            Box(
                Modifier
                    .height(8.dp)
                    .width(width)
                    .clip(CircleShape)
                    .background(color),
            )
        }
    }
}

// --- Illustrations -------------------------------------------------------------------------

private fun onboardingLogo(symbol: String): String? = when (symbol) {
    "BNB" -> TokenLogos.network(56)
    "USDT" -> TokenLogos.token(56, "0x55d398326f99059fF775485246999027B3197955")
    else -> null
}

@Composable
private fun rememberSlowRotation(durationMs: Int = 24000): Float {
    val transition = rememberInfiniteTransition(label = "orbit")
    val angle by transition.animateFloat(
        0f, 360f, infiniteRepeatable(tween(durationMs, easing = LinearEasing), RepeatMode.Restart), label = "angle",
    )
    return angle
}

@Composable
private fun GlowBackdrop() {
    val colors = VfxtTheme.colors
    Canvas(Modifier.fillMaxSize()) {
        drawCircle(
            Brush.radialGradient(listOf(colors.primary.copy(alpha = 0.28f), colors.background.copy(alpha = 0f))),
        )
        drawCircle(colors.border, radius = size.minDimension * 0.46f, style = Stroke(1.dp.toPx()))
        drawCircle(colors.border.copy(alpha = 0.5f), radius = size.minDimension * 0.33f, style = Stroke(1.dp.toPx()))
    }
}

@Composable
private fun WelcomeIllustration() {
    val angle = rememberSlowRotation()
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        GlowBackdrop()
        Box(
            Modifier
                .size(120.dp)
                .clip(RoundedCornerShape(36.dp))
                .background(VfxtTheme.colors.card)
                .border(1.dp, VfxtTheme.colors.border, RoundedCornerShape(36.dp)),
            contentAlignment = Alignment.Center,
        ) { VfxtLogoMark(size = 72.dp) }
        // Token badges orbiting on the outer ring.
        Box(Modifier.fillMaxSize().rotate(angle)) {
            listOf("BNB" to 0f, "USDT" to 120f, "VFXT" to 240f).forEach { (symbol, base) ->
                val rad = Math.toRadians(base.toDouble())
                Box(
                    Modifier
                        .align(Alignment.Center)
                        .offset(x = (129 * kotlin.math.cos(rad)).dp, y = (129 * kotlin.math.sin(rad)).dp)
                        .rotate(-angle),
                ) { TokenIcon(symbol, size = 40.dp, logoUrl = onboardingLogo(symbol)) }
            }
        }
    }
}

@Composable
private fun SecurityIllustration() {
    val colors = VfxtTheme.colors
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        GlowBackdrop()
        Box(
            Modifier
                .size(128.dp)
                .clip(CircleShape)
                .background(colors.brandGradient),
            contentAlignment = Alignment.Center,
        ) {
            Icon(Icons.Filled.Shield, null, tint = colors.onPrimary.copy(alpha = 0.25f), modifier = Modifier.size(96.dp))
            Icon(Icons.Filled.Lock, null, tint = colors.onPrimary, modifier = Modifier.size(44.dp))
        }
        FloatingChip(Icons.Filled.Key, "Keystore encrypted", Modifier.align(Alignment.TopStart).offset(x = 0.dp, y = 36.dp))
        FloatingChip(Icons.Filled.Fingerprint, "Biometric lock", Modifier.align(Alignment.BottomEnd).offset(y = (-36).dp))
    }
}

@Composable
private fun FloatingChip(icon: androidx.compose.ui.graphics.vector.ImageVector, text: String, modifier: Modifier) {
    val colors = VfxtTheme.colors
    Row(
        modifier
            .clip(RoundedCornerShape(14.dp))
            .background(colors.card)
            .border(1.dp, colors.border, RoundedCornerShape(14.dp))
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, null, tint = colors.success, modifier = Modifier.size(16.dp))
        Spacer(Modifier.width(6.dp))
        Text(text, style = MaterialTheme.typography.labelMedium, color = colors.textPrimary)
    }
}

@Composable
private fun MiningIllustration() {
    val colors = VfxtTheme.colors
    val angle = rememberSlowRotation(6000)
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        GlowBackdrop()
        Canvas(Modifier.size(170.dp)) {
            val stroke = 10.dp.toPx()
            drawCircle(colors.card, radius = size.minDimension / 2 - stroke / 2, style = Stroke(stroke))
            drawArc(
                brush = Brush.sweepGradient(listOf(colors.electric, colors.accent, colors.electric)),
                startAngle = angle,
                sweepAngle = 250f,
                useCenter = false,
                style = Stroke(stroke, cap = StrokeCap.Round),
                topLeft = Offset(stroke / 2, stroke / 2),
                size = androidx.compose.ui.geometry.Size(size.width - stroke, size.height - stroke),
            )
        }
        Box(
            Modifier
                .size(96.dp)
                .clip(CircleShape)
                .background(colors.card),
            contentAlignment = Alignment.Center,
        ) {
            Icon(Icons.Filled.Bolt, null, tint = colors.electric, modifier = Modifier.size(52.dp))
        }
    }
}

@Composable
private fun AssetsIllustration() {
    val colors = VfxtTheme.colors
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        GlowBackdrop()
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            listOf("BNB" to "BNB Smart Chain", "USDT" to "Tether USD", "VFXT" to "VFXT Token")
                .forEachIndexed { i, (symbol, name) ->
                    Row(
                        Modifier
                            .offset(x = ((i - 1) * 14).dp)
                            .width(220.dp)
                            .clip(RoundedCornerShape(16.dp))
                            .background(colors.card)
                            .border(1.dp, colors.border, RoundedCornerShape(16.dp))
                            .padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        TokenIcon(symbol, size = 34.dp, logoUrl = onboardingLogo(symbol))
                        Spacer(Modifier.width(10.dp))
                        Column(Modifier.weight(1f)) {
                            Text(symbol, style = MaterialTheme.typography.titleSmall, color = colors.textPrimary)
                            Text(name, style = MaterialTheme.typography.bodySmall, color = colors.textSecondary)
                        }
                        // Decorative bar only; no balances are shown in onboarding.
                        Box(
                            Modifier
                                .width(42.dp)
                                .height(8.dp)
                                .clip(CircleShape)
                                .background(colors.cardRaised),
                        )
                    }
                }
        }
    }
}

@Preview
@Composable
private fun OnboardingPreview() {
    VfxtTheme { OnboardingScreen({}, {}, {}) }
}
