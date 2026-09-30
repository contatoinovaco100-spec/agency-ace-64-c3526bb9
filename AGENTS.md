# Project architecture decisions

- Load Sora and Manrope from local `@fontsource` packages; this avoids external font failures and keeps the INOVA interface consistent.
- Scope executive dashboard visual overrides under `.admin-dashboard`; this preserves the styling of operational and public pages.