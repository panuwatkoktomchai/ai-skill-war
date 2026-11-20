// App theme: Material 3 with text sizes raised for users aged 60+ (body 20sp, headings 32sp).
package com.apgame.companion.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.sp

private val INK = Color(0xFF111111)
private val PRIMARY_BLUE = Color(0xFF0B4F8A)

private val ElderlyTypography = Typography().run {
    copy(
        bodyLarge = bodyLarge.copy(fontSize = 20.sp, lineHeight = 30.sp),
        bodyMedium = bodyMedium.copy(fontSize = 18.sp, lineHeight = 27.sp),
        headlineLarge = headlineLarge.copy(fontSize = 32.sp, lineHeight = 44.sp),
        titleLarge = titleLarge.copy(fontSize = 24.sp, lineHeight = 34.sp),
        labelLarge = labelLarge.copy(fontSize = 20.sp)
    )
}

private val HighContrastColors = lightColorScheme(
    primary = PRIMARY_BLUE,
    onBackground = INK,
    onSurface = INK
)

@Composable
fun CompanionTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = HighContrastColors,
        typography = ElderlyTypography,
        content = content
    )
}
