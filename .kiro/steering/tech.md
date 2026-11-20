---
inclusion: always
---
# Tech stack and rules

## Stack
- **Mobile app:** Expo (React Native) with TypeScript in strict mode and Expo Router. The app lives in `app/` at the repo root.
- **Running on the phone:** run `npx expo start` and scan the QR code with **Expo Go** on the Android phone. The phone and laptop must be on the same Wi-Fi; if they are not, use `npx expo start --tunnel`.
- **Backend:** a small API that holds every secret and calls the LLM, for example AWS Lambda with Bedrock if the organisers' account allows it. **Never put an API key in the app.**
- Use the Expo skills in `.kiro/skills/expo-*` for Expo work. Load `expo-overview` first.

## Why Expo with Expo Go
- Only one day to build. Expo Go runs the code on the real phone in seconds with no Gradle build, and saving a file updates the phone straight away.
- The team already writes React and TypeScript.

## Limits of Expo Go (check before choosing a library)
- Only libraries bundled in Expo Go work. A library that needs its own native code needs a development build (`expo-dev-client`). That is a Gradle build of 10+ minutes, so ask the team before adding one.
- Works in Expo Go:
  - text-to-speech (`expo-speech`)
  - recording audio (`expo-audio`)
  - notifications (`expo-notifications`, local notifications only)
  - storage (`expo-sqlite`, `expo-secure-store`)
  - camera (`expo-camera`)
- Thai speech-to-text: on-device recognition needs a development build. In Expo Go, record with `expo-audio` and send the audio to a cloud speech-to-text service through the backend.

## Code rules
- Screens stay small. Logic lives in hooks or `lib/`, not inside JSX.
- Every user-facing string lives in `constants/strings.ts` (Thai).
- Every network call shows loading and error states. No silent failures.
- No `any`. Validate data from the network with Zod before using it.
