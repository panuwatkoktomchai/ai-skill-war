# Mobile development research (20 Nov 2026)

How mobile developers set up AI agents in 2026, and why this project chose its stack. Shared with every AI-DLC agent.

## How the field sets up agents
- **Agent Skills open standard:** a folder per skill with a `SKILL.md` file (frontmatter `name` + `description`). The agent loads only the description at start and the full text when a request matches. Kiro reads them from `.kiro/skills/`.
- **Official vendor skills over community ones.** Expo publishes official skills (MIT, github.com/expo/skills); Google publishes about 20 official Android skills (github.com/android/skills) for Kotlin/Compose work.
- **Install few skills.** The Android team warns each installed skill adds 100–200 tokens to every task, so install only what the project uses.
- **Project rules in steering files** (Kiro `.kiro/steering/`, Claude Code `CLAUDE.md`, Cursor rules), one topic per file.

## Stack decision (changed 20 Nov): native Android, Kotlin + Jetpack Compose
- The team chose native Android only. The Expo skills were removed; Google's official Android skills (github.com/android/skills) can be added if needed, after reading them.
- Kotlin + Compose is Google's recommended stack. Each change needs a Gradle build (about 30 s incremental on this Mac).
- Checks: Spotless + ktlint (formatting, like Prettier) with the Compose rules set, Android Lint with warnings as errors (like ESLint), Kotlin warnings as errors. detekt was not added: its stable 1.23.x only supports Kotlin 2.0, and this project uses Kotlin 2.4.

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
