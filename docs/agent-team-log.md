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
- Ran the production build + `next start` against a local stub Supabase API with sample rows: build passes, and Playwright at 375px confirmed chips render and wrap (no horizontal scroll), removing a chip updates the URL and keeps keyboard focus on a neighbouring chip, card links carry `?from=`, the detail page back link restores the filters, and `?maxTuition=abc` is ignored.
- Local `next build` against a stub Supabase API (returns empty lists): **passes** (exit 0, only the pre-existing Edge-runtime warning from supabase-js in middleware).
- **Vercel and Netlify preview deploys on PR #28 both failed**; logs need a login the agents don't have. Earlier branches (Nov 9, Nov 16) deployed fine on both. The same code builds with sample data locally, so the cause is most likely in the hosting build environment (e.g. build-time data fetch), but that is unconfirmed. PR left as draft for Eziz to check the deploy logs.

**Backlog / ideas for later runs**
- Universities list: `sort` and `deadline` URL params are cast without validation (bad values silently fall back in the switch, but the select shows nothing). Reuse the scholarship parse pattern.
- Nav link to the list while already on a filtered list keeps the old filters on screen but clears the URL (both lists). Fix by remounting the list client on a param reset.
- `prefs=1` / `scores=1` travel in shared links; consider leaving personal toggles out of the link the user copies.
- Scholarships page: a "closing in the next 30 days" quick filter (on top of the existing "Deadline: closest" sort) would help students act in time.
- Add a "Copy link to this search" button now that both lists are shareable.
- Home page prerender fails without Supabase env; a graceful fallback would make local/CI builds possible.

## 2026-11-24 — Readable test requirements + sticky mobile actions

**Branch:** `agents/2026-11-24-readable-tests-sticky-actions`

**What was chosen and why**
- PR #28 (yesterday) is still an open draft and rewrites both list clients, so today stayed out of `UniversityListClient` / `ScholarshipListClient` to avoid conflicts.
- Live check of /en/universities at phone width found raw translation keys on cards, e.g. `university.test_abbr_pte 59` and `university.test_abbr_cambridge c2 proficiency 180` (~60 occurrences on the list page). The import job writes ~30 different test `type` strings, but the UI only knew TOEFL/IELTS/SAT/Duolingo; on detail pages the other exams showed as empty ✓ rows. Students reading requirements is core, so this was task A.
- On a phone the university detail page is ~2,600px tall and Save / Official website / Apply were only at the very bottom as three stacked buttons. Task B: make that row a compact bar that sticks to the bottom of the screen on mobile (CSS `sticky`, no new JS, no duplicated buttons); desktop unchanged. Same on scholarship detail.

**Who did what**
- CEO: looked at the live site at 390px, found both problems, checked open PRs, wrote briefs, reviewed diffs, committed.
- Senior SWE (opus): `lib/data/test-labels.ts` (normalise/alias/humanize test types, keep non-tests like `other` out of the score summary), `TestRequirementsSummary`, `EntranceRequirements` (every exam + min score + the data's note, including core tests), widened `TestEntry` type while `suggestTier` still scores only the 4 profile tests, 21 i18n keys × 3 locales, 30 unit tests. Checked against 76 real requirement blobs from the live payload: 0 raw keys, 0 empty rows. Also reviewed the junior's work (no changes needed).
- Junior SWE (sonnet): sticky mobile action row on both detail pages, icon-only Save on mobile (label stays for screen readers), admin Edit link hidden on mobile.
- Tester (sonnet): tsc / eslint / vitest / build, plus Playwright on a production build against a local Supabase stub.
- Researcher: not used (the problems came straight from the live site and data).

**Test results**
- `npx tsc --noEmit` pass; `npx eslint . --max-warnings=0` pass; `npx vitest run` 30 files, 518 tests pass (30 new).
- `next build` passes against a local Supabase stub; `next start` + Playwright at 360/390/1280 in en/ru/tk: no raw i18n keys; summary shows "PTE Academic 59, Cambridge English 180…"; mobile bar pinned to the viewport bottom at load and mid-scroll, one row, all targets ≥44px, no horizontal scroll, returns to normal flow below the data notice at page end; desktop row static with Save label; Tab order Save → Website → Apply; Save has a localized accessible name.
- Contrast: Website button 10.97:1. Apply (white on gold) is 2.63:1, below AA — pre-existing, not changed here.

**Backlog / ideas for later runs**
- **Data-loss risk (admin):** `components/admin/EntranceRequirementsEditor.tsx` `parseTests` drops every non-core test type, so saving a university in the admin panel silently deletes its PTE/Cambridge/etc. entries. Needs a fix soon.
- Universities list page is 6.1 MB of HTML (≈670 KB compressed) because all ~1,080 cards are rendered and every full row is sent to the client. Add "show more" pagination and pass only the fields the card needs. Do this after PR #28 merges (same files).
- Apply button contrast (white on `gold`) fails AA; consider `gold-dark` or dark text, site-wide for gold buttons.
- Website/Apply `aria-label`s hard-code English "(opens in new tab)" in ru/tk.
- Import data: some entries are in the wrong field (e.g. essay types / `womens_college` inside `tests`), a Duolingo entry is listed under tests although its note says "NOT accepted"; the import job could validate test types.
- Entries carry `scale` / `max_possible` that the UI ignores; showing "min 59 / 90" for PTE etc. would need those fields verified first.
- Items from 2026-11-23 backlog still open (sort/deadline URL validation, "closing in 30 days" filter, copy-link button, home prerender fallback).

## 2026-11-26 — Lighter universities list: slim data + "Show more"

**Branch:** `agents/2026-11-26-faster-university-list`

**Context at start**
- PR #28 (Nov 23) was closed unmerged; PR #29 (Nov 24) is still open. This log file only existed on #29's branch, so this branch carries those two entries plus today's (if both merge, keep all three entries).
- unipathtm.vercel.app returns HTTP 402 `DEPLOYMENT_DISABLED` (Vercel team paused). Live hosting is moving to Netlify; the agents don't know the Netlify URL, so no live check was possible today.

**What was chosen and why**
- The universities list was the heaviest page on the site (earlier measured ~6.1 MB of HTML): it rendered all ~1,080 cards in the server HTML and sent every full row (semesters, tuition options, full entrance requirements, websites) to the browser, then rendered all 1,080 cards again. Students on slow, expensive mobile data in Turkmenistan pay for that on every visit, and it also costs hosting usage. Page speed is part of the UX focus, so this was today's single task. Stayed out of the files PR #29 touches.

**What changed**
- `lib/data/university-list-item.ts`: `UniversityListItem` / `toUniversityListItem` — only what the card, filters, sort and personalisation read (tests array kept unchanged; only semester deadlines kept).
- `app/[locale]/universities/page.tsx`: sends slim items; server fallback HTML renders the first 24 cards (detail pages stay in `app/sitemap.ts`).
- `UniversityListClient`: 24 results at a time, "Showing X of Y" + "Show more" (44px, visible focus ring); count kept in the URL as `show=<n>` and in each card's `?from=` link, so Back returns to the same depth; resets on any filter/search/sort change; focus moves to the first new card; results count is `aria-live`.
- `lib/data/list-pagination.ts` (pure helpers), widened types in `filterUniversities` / `testsOf` / `getNextDeadline` (callers unchanged), inset focus ring on card links, i18n keys in tk/ru/en.

**Who did what**
- CEO: checked open/closed PRs and live hosting, chose the task, wrote the brief, reviewed the diff, made two small fixes after testing (solid focus ring on the button, simpler Turkmen "Görkezilýär: 24 / 1080"), wrote this log and the PR.
- Senior SWE (opus): implementation, 20 unit tests, local Supabase stub with 1,080 synthetic rows, before/after measurement, Playwright smoke test.
- Tester (sonnet): independent tsc / eslint / vitest / build / Playwright at 360, 390, 1280 px in en/ru/tk, contrast and focus checks.
- Researcher, Junior SWE: not used (task came straight from the code and an earlier measurement).

**Test results**
- `npx tsc --noEmit` pass; `npx eslint . --max-warnings=0` pass; `npx vitest run` 31 files, 508 tests pass (20 new).
- `next build` against the local stub: pass (only the usual supabase-js Edge-runtime warning).
- Size of /en/universities against the stub (synthetic data, heavier than real): HTML 9.96 MB → 2.42 MB raw (−76%), 481 KB → 236 KB gzip (−51%); data sent to the browser 6.72 MB → 2.15 MB; server-rendered cards 1,080 → 24.
- Playwright: 24 cards + 44px button, no horizontal scroll at 360/390/1280; Enter → 48 cards, focus on card 25, `?show=48`; Back from a card restores 48; search / country filter / sort reset to 24; `show=abc` → 24, `show=30` → 48, `show=99999` → all, no button; ru/tk translated, no raw keys. Contrast: button 18.4:1, "Showing" text 4.70:1 (AA, but close to the limit).

**Backlog / ideas for later runs**
- `majors` arrays are now most of the remaining list payload in the stub (~1.4 of ~2.1 MB). Send each major as an index into the `majors` list the page already sends (est. −1.2 MB raw, gzip 132 → 75 KB on stub data). Check real data sizes first.
- Same treatment for the scholarships list (it receives every scholarship in full).
- `sort` / `deadline` URL params on the universities list are still cast without validation.
- Native speaker check of the tk strings `show_more` / `showing_count`.
- Items from earlier backlogs still open: admin `EntranceRequirementsEditor` drops non-core tests on save (data-loss risk), Apply button contrast (white on gold, 2.63:1), English-only "(opens in new tab)" labels, "closing in 30 days" scholarship filter, copy-link button.
