package com.vfxt.wallet.core.designsystem.theme

import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color

/** Raw brand palette. Screens should read colors through [VfxtTheme.colors], never these directly. */
object VfxtPalette {
    val Midnight = Color(0xFF080D19)
    val Navy = Color(0xFF101827)
    val Slate = Color(0xFF151F31)
    val SlateRaised = Color(0xFF1B2740)
    val Border = Color(0xFF26344A)

    val Blue = Color(0xFF2878FF)
    val Electric = Color(0xFF00A6FF)
    val Purple = Color(0xFF8157FF)
    val Success = Color(0xFF16C784)
    val Error = Color(0xFFEA3943)
    val Warning = Color(0xFFF5A524)

    val White = Color(0xFFFFFFFF)
    val SlateText = Color(0xFF94A3B8)
    val MutedText = Color(0xFF64748B)

    // Light theme
    val Cloud = Color(0xFFF5F7FB)
    val Paper = Color(0xFFFFFFFF)
    val Mist = Color(0xFFEDF1F7)
    val LightBorder = Color(0xFFDCE3EE)
    val Ink = Color(0xFF0B1220)
    val InkSecondary = Color(0xFF526077)
}

/**
 * Semantic colors used across the app. Kept separate from Material's ColorScheme so that
 * wallet-specific roles (gain/loss, card layers, borders) have explicit names.
 */
@Immutable
data class VfxtColors(
    val background: Color,
    val surface: Color,
    val card: Color,
    val cardRaised: Color,
    val border: Color,
    val primary: Color,
    val electric: Color,
    val accent: Color,
    val success: Color,
    val error: Color,
    val warning: Color,
    val textPrimary: Color,
    val textSecondary: Color,
    val textMuted: Color,
    val onPrimary: Color,
    val isDark: Boolean,
) {
    /** Primary brand gradient, used on hero cards and primary CTAs only. */
    val brandGradient: Brush
        get() = Brush.linearGradient(listOf(primary, electric))

    /** Deeper gradient for the portfolio hero card. */
    val heroGradient: Brush
        get() = Brush.linearGradient(
            listOf(Color(0xFF1B4FD6), primary, Color(0xFF5A63FF)),
        )

    val accentGradient: Brush
        get() = Brush.linearGradient(listOf(accent, primary))
}

val DarkVfxtColors = VfxtColors(
    background = VfxtPalette.Midnight,
    surface = VfxtPalette.Navy,
    card = VfxtPalette.Slate,
    cardRaised = VfxtPalette.SlateRaised,
    border = VfxtPalette.Border,
    primary = VfxtPalette.Blue,
    electric = VfxtPalette.Electric,
    accent = VfxtPalette.Purple,
    success = VfxtPalette.Success,
    error = VfxtPalette.Error,
    warning = VfxtPalette.Warning,
    textPrimary = VfxtPalette.White,
    textSecondary = VfxtPalette.SlateText,
    textMuted = VfxtPalette.MutedText,
    onPrimary = VfxtPalette.White,
    isDark = true,
)

val LightVfxtColors = VfxtColors(
    background = VfxtPalette.Cloud,
    surface = VfxtPalette.Paper,
    card = VfxtPalette.Paper,
    cardRaised = VfxtPalette.Mist,
    border = VfxtPalette.LightBorder,
    primary = VfxtPalette.Blue,
    electric = Color(0xFF0088D6),
    accent = VfxtPalette.Purple,
    success = Color(0xFF0E9F6A),
    error = Color(0xFFD62F39),
    warning = Color(0xFFC77D00),
    textPrimary = VfxtPalette.Ink,
    textSecondary = VfxtPalette.InkSecondary,
    textMuted = Color(0xFF8592A8),
    onPrimary = VfxtPalette.White,
    isDark = false,
)

val LocalVfxtColors = staticCompositionLocalOf { DarkVfxtColors }
