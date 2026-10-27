# Project architecture decisions

- Load Sora and Manrope from local `@fontsource` packages; this avoids external font failures and keeps the INOVA interface consistent.
- Scope executive dashboard visual overrides under `.admin-dashboard`; this preserves the styling of operational and public pages.
- Classify reference attachments using the task-scoped `references/` storage folder and the shared attachment-purpose helper; this preserves legacy deliveries and keeps references out of final galleries without changing the database schema.
- MCP server lives in `src/lib/mcp/` (one `defineTool` per file, registered in `index.ts`); the Vite plugin from `@lovable.dev/mcp-js/stacks/supabase/vite` generates `supabase/functions/mcp/index.ts` — never hand-edit the generated file. OAuth consent page is `src/pages/OAuthConsent.tsx` at `/.lovable/oauth/consent`; login preserves the validated `next` path via `src/lib/oauth-return-path.ts`.
