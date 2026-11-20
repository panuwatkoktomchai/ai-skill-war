# Mobile development research (20 Nov 2026)

How mobile developers set up AI agents in 2026, and why this project chose its stack. Shared with every AI-DLC agent.

## How the field sets up agents
- **Agent Skills open standard:** a folder per skill with a `SKILL.md` file (frontmatter `name` + `description`). The agent loads only the description at start and the full text when a request matches. Kiro reads them from `.kiro/skills/`.
- **Official vendor skills over community ones.** Expo publishes official skills (MIT, github.com/expo/skills); Google publishes about 20 official Android skills (github.com/android/skills) for Kotlin/Compose work.
- **Install few skills.** The Android team warns each installed skill adds 100–200 tokens to every task, so install only what the project uses.
- **Project rules in steering files** (Kiro `.kiro/steering/`, Claude Code `CLAUDE.md`, Cursor rules), one topic per file.

## Skills installed here (Expo, commit 88d9bd7)
| Skill | Use it for |
|---|---|
| expo-overview | Entry point. Load first for any Expo task |
| expo-project-structure | Folder layout of the new app |
| expo-router | Screens, tabs, modals, headers |
| expo-native-ui | Native-feeling controls, storage, media |
| expo-design-system | Theme tokens and shared components |
| expo-data-fetching | Calling the backend, loading/error states, offline |
| expo-dev-client | Only if a development build becomes necessary |

Not installed:
- Paid EAS skills (app stores, hosting, workflows, update).
- iOS-only skills.
- Android native skills. These are for Kotlin; add `android-cli` or `testing-setup` from github.com/android/skills only if the team switches to native.

## Stack decision: Expo + Expo Go, not native Kotlin, not a PWA
- **Native Kotlin/Compose:** best platform access, but every change needs a Gradle build and the team does not write Kotlin daily. Too slow for one day.
- **PWA:** fastest to build, but it is not an installed Android app, and Thai voice support depends on the browser.
- **Expo:** React + TypeScript, which the team already knows. Expo Go runs on the real phone with no build and updates live on save. It can still become a development build or an APK later.

## UX for older users (sources)
- Touch targets: Apple's 44 pt and Android's 48 dp are minimums; research on older adults recommends larger targets with more spacing.
- Text: older adults prefer at least 14 pt sans-serif (OzCHI 2024); others advise at least 16 px. The common advice is to let the user enlarge text. This project uses 18 sp body text.
- A Thai study on mobile UI for senior citizens (Chulalongkorn University) is a local reference worth reading.

## Sources
- https://github.com/expo/skills
- https://docs.expo.dev/skills/
- https://developer.android.com/tools/agents/android-skills/browse
- https://android-developers.googleblog.com/2026/08/android-skills-philosophy.html
- https://kiro.dev/docs/skills/
- https://kiro.dev/docs/steering/
- https://arxiv.org/html/2504.12690v1
- https://outbox.eait.uq.edu.au/uqsville/OzCHI2024/Long%20Papers/Design%20for%20Older%20People%20-%20Improving%20the%20Usability%20of%20Mobile%20Apps%20through%20Targeted%20Design%20Recommendations.pdf
- https://www.cp.eng.chula.ac.th/~twittie/research/publications/MobileUIGuidelinesforSeniorCitizens.pdf
- https://www.smashingmagazine.com/2015/02/designing-digital-technology-for-the-elderly/
