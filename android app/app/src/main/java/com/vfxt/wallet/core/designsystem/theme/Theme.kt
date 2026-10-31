package com.vfxt.wallet.core.designsystem.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.ReadOnlyComposable

enum class ThemeMode { Dark, Light }

private fun VfxtColors.toMaterialScheme() = if (isDark) {
    darkColorScheme(
        primary = primary,
        onPrimary = onPrimary,
        secondary = electric,
        tertiary = accent,
        background = background,
        onBackground = textPrimary,
        surface = surface,
        onSurface = textPrimary,
        surfaceVariant = card,
        onSurfaceVariant = textSecondary,
        surfaceContainer = card,
        surfaceContainerHigh = cardRaised,
        surfaceContainerHighest = cardRaised,
        surfaceContainerLow = surface,
        outline = border,
        outlineVariant = border,
        error = error,
    )
} else {
    lightColorScheme(
        primary = primary,
        onPrimary = onPrimary,
        secondary = electric,
        tertiary = accent,
        background = background,
        onBackground = textPrimary,
        surface = surface,
        onSurface = textPrimary,
        surfaceVariant = cardRaised,
        onSurfaceVariant = textSecondary,
        surfaceContainer = card,
        surfaceContainerHigh = cardRaised,
        surfaceContainerHighest = cardRaised,
        surfaceContainerLow = surface,
        outline = border,
        outlineVariant = border,
        error = error,
    )
}

@Composable
fun VfxtTheme(
    themeMode: ThemeMode = ThemeMode.Dark,
    content: @Composable () -> Unit,
) {
    val colors = if (themeMode == ThemeMode.Dark) DarkVfxtColors else LightVfxtColors
    CompositionLocalProvider(LocalVfxtColors provides colors) {
        MaterialTheme(
            colorScheme = colors.toMaterialScheme(),
            typography = VfxtTypography,
            shapes = VfxtShapes,
            content = content,
        )
    }
}

/** Accessors mirroring [MaterialTheme] so call sites read `VfxtTheme.colors.card`. */
object VfxtTheme {
    val colors: VfxtColors
        @Composable @ReadOnlyComposable
        get() = LocalVfxtColors.current
}
