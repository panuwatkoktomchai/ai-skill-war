---
inclusion: always
---
# UX rules for older users (apply to every screen)

The users are 60+, may see poorly, may have shaky hands, and may be afraid of "pressing the wrong thing".

## Size and readability
- Body text is at least **18 sp** and headings at least 24 sp. Respect the phone's font-scale setting; never set `allowFontScaling={false}`.
- Touch targets are at least **56 dp** high, which is more than the 48 dp Android minimum, with at least 12 dp between them.
- Text contrast is at least 7:1 (WCAG AAA). Do not use grey text on white.
- Use a plain sans-serif font that renders Thai well, such as Sarabun or Noto Sans Thai, and keep line height generous.

## Simplicity
- Each screen has one main action, shown as a big button with an icon **and** a Thai label. Never use an icon on its own.
- Use taps only. Do not rely on swipes, long-presses, double-taps, or pinches.
- Navigation is shallow, at most 2 levels deep, and every screen has a clear "back" or "home" button.
- Avoid jargon and English. Say "ส่ง" (send), not "Submit".

## Safety and confidence
- Confirm anything that cannot be undone (sending, calling, deleting) in a dialog with two big buttons.
- Show what is happening: "กำลังฟัง…" (listening…), "กำลังคิด…" (thinking…). Never leave a blank screen.
- Error messages say what to do next, in plain Thai, with a retry button.
- Speak important answers aloud as well (`expo-speech`), and offer a button to repeat them.

## Voice first
- The main screen has one large microphone button. Speaking must be the easiest way to use the app.
- The AI introduces itself as an AI on first use.
