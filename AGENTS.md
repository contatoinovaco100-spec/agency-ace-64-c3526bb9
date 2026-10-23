# Project architecture decisions

- Load Sora and Manrope from local `@fontsource` packages; this avoids external font failures and keeps the INOVA interface consistent.
- Scope executive dashboard visual overrides under `.admin-dashboard`; this preserves the styling of operational and public pages.
- Classify reference attachments using the task-scoped `references/` storage folder and the shared attachment-purpose helper; this preserves legacy deliveries and keeps references out of final galleries without changing the database schema.