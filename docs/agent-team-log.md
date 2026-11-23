# Agent team log

Daily log of the unattended AI dev team (CEO + Researcher / Senior SWE / Junior SWE / Tester) working on UniPath. Newest entry at the bottom. Each run reads this first to avoid repeating or conflicting with earlier work.

## 2026-11-23 — Shareable scholarship filters + active filter chips

**Branch:** `agents/2026-11-23-scholarship-filter-urls`

**What was chosen and why**
- The universities list already keeps its filters in the URL, so "back" from a university and shared links keep the filtered view. The scholarships list didn't: all filters were plain React state, so a student who filtered by country/coverage/deadline lost everything on "back", and couldn't send a filtered list to a friend. Scholarship discovery is a core focus, so this was the main task.
- Second, small task: both lists hide almost every filter inside a sheet, and the only hint that filters are on is a number badge. On a phone, "3 results" gave no clue why. Added visible, removable "active filter" chips and a "Clear filters" button in the empty state.

**Who did what**
- CEO: picked the task from the code (compared `UniversityListClient` vs `ScholarshipListClient`), wrote briefs, wired the chips into the scholarships list, reviewed, committed.
- Senior SWE (opus): `lib/data/scholarship-filter-query.ts` (validated parse/build of URL params) + tests; URL sync in `ScholarshipListClient`; `?from=` on scholarship cards; `keepListFilters` on the scholarship detail back link. Then reviewed the chips work and fixed its findings (USD+TMT on money chips, focus management, gating personalisation chips, `maxTuition` URL validation, pure chip builders + tests, `aria-live` results count).
- Junior SWE (sonnet): `components/ui/ActiveFilterChips.tsx`, i18n keys `common.active_filters` / `common.remove_filter` (tk/ru/en), chips + empty-state button on the universities list.
- Tester (sonnet): tsc, eslint, vitest, build, static a11y review, contrast check.
- Researcher: not used (task came straight from the existing code pattern).

**Test results**
- `npx tsc --noEmit`: pass. `npx eslint . --max-warnings=0`: pass. `npx vitest run`: 31 files, 514 tests pass (26 new).
- `next build`: compiles and type-checks; prerender of `/[locale]` fails only because there are no Supabase credentials in the agent sandbox (that page is not touched by this change). Vercel preview on the PR is the real build check.
- Chip text contrast (`text-primary` on `bg-primary/10`): 9.77:1 (WCAG AA needs 4.5:1). Chips ≥32px tall, wrap at 360px, every button has an accessible name.
- No screenshots: pages need live Supabase data, which the sandbox doesn't have.

**Backlog / ideas for later runs**
- Universities list: `sort` and `deadline` URL params are cast without validation (bad values silently fall back in the switch, but the select shows nothing). Reuse the scholarship parse pattern.
- Nav link to the list while already on a filtered list keeps the old filters on screen but clears the URL (both lists). Fix by remounting the list client on a param reset.
- `prefs=1` / `scores=1` travel in shared links; consider leaving personal toggles out of the link the user copies.
- Scholarships page: "Deadline closest" sort + a "closing in 30 days" quick filter would help students act in time.
- Add a "Copy link to this search" button now that both lists are shareable.
- Home page prerender fails without Supabase env; a graceful fallback would make local/CI builds possible.
