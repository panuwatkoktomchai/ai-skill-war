# ai-skill-war

## Android app
Kotlin + Jetpack Compose, one Gradle project at the repo root (`app/` module).

- Build and install on a plugged-in phone (USB debugging on): `./gradlew installDebug`
- Format Kotlin: `./gradlew spotlessApply`
- Checks before every commit: `./gradlew spotlessCheck lint`

Needs JDK 21 (`brew install openjdk@21`, then `export JAVA_HOME=/opt/homebrew/opt/openjdk@21`) and the Android SDK (Android Studio installs it; set its path in `local.properties` as `sdk.dir=...`).
