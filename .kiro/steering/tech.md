---
inclusion: always
---
# Tech stack and rules

## Stack (team decision 20 Nov: native Android only, no Expo, no iOS)
- **Language and UI:** Kotlin + Jetpack Compose (Material 3). One Gradle project at the repo root, app module in `app/`, package `com.apgame.companion`.
- **Versions:** every library and plugin version lives in `gradle/libs.versions.toml`. Never write a version inside a `build.gradle.kts`.
- **SDK:** compileSdk/targetSdk 36, minSdk 26 (Android 8.0), Java 17 bytecode, built with JDK 21.
- **Backend:** a small API that holds every secret and calls the LLM, for example AWS Lambda with Bedrock if the organisers' account allows it. **Never put an API key in the app** (not in code, not in `BuildConfig`, not in resources).

## Architecture (Google's recommended app architecture)
- UI (Composables) → ViewModel (holds `StateFlow<UiState>`) → Repository → data sources (Room, Retrofit/Ktor).
- State flows down, events flow up. Composables draw state and call ViewModel functions; no logic inside Composables.
- Long work runs in coroutines (`viewModelScope`), never on the main thread.

## Running on the phone
- Turn on Developer options + USB debugging on the Android phone, plug it in, then `adb devices` must list it.
- `./gradlew installDebug` installs the app; open "ผู้ช่วย AI" on the phone.
- Or open the repo in Android Studio and press Run.

## Checks (run before every commit)
- `./gradlew spotlessApply` formats Kotlin (ktlint, Android Studio style, 100-char lines, plus Compose rules). This is the Kotlin equivalent of Prettier.
- `./gradlew spotlessCheck lint` must pass. `lint` is Android Lint with warnings as errors; Kotlin compiler warnings are errors too. This is the equivalent of ESLint.
- Never switch off a rule for a whole file. Suppress one finding with `@Suppress("RuleName")` and a comment saying why.

## Code rules
- Every user-facing string lives in `app/src/main/res/values/strings.xml` (Thai). Never hard-code Thai text in Kotlin.
- Named constants for meaningful numbers (sizes, timeouts); no magic numbers in Composables.
- Every network call shows loading and error states. No silent failures, no empty `catch`.
- Validate data from the network (kotlinx.serialization with explicit types) before using it.
- Ask the team before adding a new library; write its licence and last release date in the commit message.
