// Root build: declares plugin versions once and the shared Kotlin format/lint check (Spotless + ktlint).
plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.kotlin.compose) apply false
    alias(libs.plugins.spotless)
}

spotless {
    kotlin {
        target("**/*.kt")
        targetExclude("**/build/**")
        ktlint(libs.versions.ktlint.get())
            .customRuleSets(
                listOf("io.nlopez.compose.rules:ktlint:${libs.versions.composeRules.get()}")
            )
    }
    kotlinGradle {
        target("**/*.gradle.kts")
        targetExclude("**/build/**")
        ktlint(libs.versions.ktlint.get())
    }
}
