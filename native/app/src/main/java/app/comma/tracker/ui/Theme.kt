package app.comma.tracker.ui

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp

// The Comma phone app's look, carried onto Material 3 roles: the palette from
// src/theme/colors.ts, the type ramp and corner radii from tailwind.config.js, and the
// system font. Nothing here is invented, and nothing comes from the marketing kit.
private val Black = Color(0xFF000000)
private val White = Color(0xFFFFFFFF)
private val Green = Color(0xFF22C55E)

private val DarkColors = darkColorScheme(
    primary = Green,
    onPrimary = White,
    primaryContainer = Green,
    onPrimaryContainer = White,
    secondary = Color(0xFF9B9BA4),
    onSecondary = Black,
    secondaryContainer = Color(0xFF26262C),
    onSecondaryContainer = Color(0xFFF6F6F7),
    tertiary = Color(0xFF3B82F6),
    onTertiary = White,
    tertiaryContainer = Color(0xFF1C1C21),
    onTertiaryContainer = Color(0xFFF6F6F7),
    error = Color(0xFFFF5247),
    onError = White,
    errorContainer = Color(0xFF1C1C21),
    onErrorContainer = Color(0xFFFF5247),
    background = Black,
    onBackground = Color(0xFFF6F6F7),
    surface = Black,
    onSurface = Color(0xFFF6F6F7),
    surfaceVariant = Color(0xFF16161A),
    onSurfaceVariant = Color(0xFF9B9BA4),
    surfaceTint = Color(0xFF26262C),
    surfaceDim = Black,
    surfaceBright = Color(0xFF26262C),
    surfaceContainerLowest = Color(0xFF0A0A0C),
    surfaceContainerLow = Color(0xFF0F0F12),
    surfaceContainer = Color(0xFF16161A),
    surfaceContainerHigh = Color(0xFF1C1C21),
    surfaceContainerHighest = Color(0xFF26262C),
    outline = Color(0xFF2E2E36),
    outlineVariant = Color(0xFF1E1E23),
    inverseSurface = Color(0xFFF6F6F7),
    inverseOnSurface = Color(0xFF0E0E11),
    inversePrimary = Color(0xFF15803D),
    scrim = Black,
)

private val LightColors = lightColorScheme(
    primary = Green,
    onPrimary = White,
    primaryContainer = Green,
    onPrimaryContainer = White,
    secondary = Color(0xFF53535A),
    onSecondary = White,
    secondaryContainer = Color(0xFFE8E8ED),
    onSecondaryContainer = Color(0xFF0E0E11),
    tertiary = Color(0xFF2563EB),
    onTertiary = White,
    tertiaryContainer = Color(0xFFE8E8ED),
    onTertiaryContainer = Color(0xFF0E0E11),
    error = Color(0xFFDC2626),
    onError = White,
    errorContainer = Color(0xFFF0F0F4),
    onErrorContainer = Color(0xFFDC2626),
    background = White,
    onBackground = Color(0xFF0E0E11),
    surface = White,
    onSurface = Color(0xFF0E0E11),
    surfaceVariant = Color(0xFFF0F0F4),
    onSurfaceVariant = Color(0xFF53535A),
    surfaceTint = Color(0xFFDFDFE7),
    surfaceDim = Color(0xFFE8E8ED),
    surfaceBright = White,
    surfaceContainerLowest = Color(0xFFFCFCFD),
    surfaceContainerLow = Color(0xFFF6F6F9),
    surfaceContainer = Color(0xFFF0F0F4),
    surfaceContainerHigh = Color(0xFFE8E8ED),
    surfaceContainerHighest = Color(0xFFDFDFE7),
    outline = Color(0xFFD2D2DB),
    outlineVariant = Color(0xFFE5E5EB),
    inverseSurface = Color(0xFF0E0E11),
    inverseOnSurface = Color(0xFFF6F6F7),
    inversePrimary = Green,
    scrim = Black,
)

private fun type(size: Int, line: Int, weight: FontWeight, tight: Boolean = false) = TextStyle(
    fontSize = size.sp,
    lineHeight = line.sp,
    fontWeight = weight,
    letterSpacing = if (tight) (-0.025).em else 0.em,
)

// display 44 · heading-xl 28 · heading-l 22 · heading-m 18 · heading-s 16 ·
// label-l 15 · label-m 13 · label-xs 11 · paragraph-l 16 · paragraph-m 14 · paragraph-s 12
private val AppTypography = Typography(
    displayLarge = type(44, 48, FontWeight.ExtraBold, tight = true),
    displayMedium = type(44, 48, FontWeight.ExtraBold, tight = true),
    displaySmall = type(44, 48, FontWeight.ExtraBold, tight = true),
    headlineLarge = type(28, 34, FontWeight.ExtraBold, tight = true),
    headlineMedium = type(28, 34, FontWeight.ExtraBold, tight = true),
    headlineSmall = type(22, 28, FontWeight.Bold, tight = true),
    titleLarge = type(22, 28, FontWeight.Bold, tight = true),
    titleMedium = type(16, 22, FontWeight.SemiBold),
    titleSmall = type(13, 18, FontWeight.SemiBold),
    bodyLarge = type(16, 24, FontWeight.Normal),
    bodyMedium = type(14, 20, FontWeight.Normal),
    bodySmall = type(12, 16, FontWeight.Medium),
    labelLarge = type(15, 20, FontWeight.SemiBold),
    labelMedium = type(13, 18, FontWeight.SemiBold),
    labelSmall = type(11, 14, FontWeight.Bold),
)

// sm 8 (chips) · md 12 (buttons, inputs, rows) · lg 16 (cards) · 2xl 28 (dialogs)
private val AppShapes = Shapes(
    extraSmall = RoundedCornerShape(12.dp),
    small = RoundedCornerShape(8.dp),
    medium = RoundedCornerShape(12.dp),
    large = RoundedCornerShape(16.dp),
    extraLarge = RoundedCornerShape(28.dp),
)

/** Material buttons are pills by default; Comma's are 12dp rounded rectangles. */
val ButtonShape = RoundedCornerShape(12.dp)

@Composable
fun CommaTheme(dark: Boolean, content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = if (dark) DarkColors else LightColors,
        typography = AppTypography,
        shapes = AppShapes,
        content = content,
    )
}
