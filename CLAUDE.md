# CLAUDE.md – working rules for Clavis

Read `SPEC.md` before any task. It is the source of truth; this file is how to work.

## Project in one line

Clavis helps students from Turkmenistan and their parents find Ministry-approved universities, programs (bachelor's, foundation, language year) and scholarships abroad, and track applications. Website + Telegram Mini App, in Turkmen (default), Russian and English.

## Stack (fixed)

Astro + React islands on Cloudflare Workers · D1 + Drizzle · R2 · KV · Better Auth · plain CSS with tokens · Vitest + Playwright · pnpm · TypeScript strict.

## How to work

- Build one milestone at a time (M0–M8 in `SPEC.md`). At the end of each, run `pnpm lint`, `pnpm typecheck`, `pnpm test` and the milestone's Playwright checks, then stop and report. Wait for "go".
- If the spec is unclear or two parts conflict, ask one short question. Don't guess, and don't add features that aren't in the spec.
- Keep commits small, with clear messages. Don't push or deploy unless Eziz asks.
- Never connect to real services (production D1, Supabase, Google, Telegram, email) without credentials from Eziz and his go-ahead. Use local D1 and the demo seed.
- Never put secrets in the repo. Use `.dev.vars` locally (gitignored) and Wrangler secrets in production.

## Code rules

- Colors, type, spacing and radius only through CSS variables from `src/styles/tokens.css`. No raw hex values in components.
- Every UI string goes through `src/i18n`; add the key to `tk.json`, `ru.json` and `en.json` together.
- Server-render data pages (`prerender = false`) and cache them with the `data_version` key; never cache account, share or admin pages.
- Islands only where interaction is needed; prefer `client:visible`. Pages must work with JavaScript off.
- Every D1 query on a public page uses an index. Validate all API input with Zod. Rate-limit writes.
- Real HTML controls (`button`, `a`, `input` + `label`), visible focus, 44 px touch targets, 4.5:1 contrast. Fixed-height controls get `flex-shrink: 0`.
- Show unknown facts as unknown ("Cost not confirmed"), never estimates. Every public record shows Last checked and Source.
- Show total years of a path (pre-year + bachelor's) as a fact. Don't add any advice about how to report study years to authorities.
- No ads, trackers or third-party scripts. No emails except sign-in codes and deadline reminders.

## Useful commands (set up in M0)

- `pnpm dev`: local site with local D1, R2 and KV
- `pnpm db:migrate` / `pnpm db:seed`: apply migrations and load demo data
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm e2e`
