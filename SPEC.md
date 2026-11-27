# Clavis – Build Spec

Owner: Eziz Agamyradov · Version: 2026-11-27

## What we're building

Clavis is a new website and Telegram Mini App that helps students from Turkmenistan, and their parents, find Ministry-approved universities, bachelor's programs, foundation and language years, and bachelor's scholarships abroad, then track their applications. It is built from scratch in a new codebase; nothing is reused from the old UniPath repo except, optionally, exported data.

**Decisions already made (do not reopen)**

- Name: **Clavis** (Latin for "key"). Signed-in area: **My Clav**.
- Brand: pointed iwan-arch doorway mark with a coral doorway, deep green + cream, font **Onest** everywhere, light and dark themes. All values are in "UI: tokens, components and layouts" below.
- Languages: Turkmen (default), Russian, English, as full versions.
- Platforms: website first, plus a Telegram Mini App that is the same site.
- Stack: Astro + React islands on Cloudflare Workers, D1 (database), R2 (files), Better Auth (Telegram, email code, Google).
- Programs are the core unit. Foundation and language years are programs, linked to bachelor's programs by pathways. Clavis shows **total years** of a path as a plain fact and gives no advice about reporting to authorities.
- First version: program, university and scholarship search; detail pages; accounts with saved items and an application tracker; discussions. The static mirror for Turkmenistan comes after launch.
- No ads, no selling or sharing data, no marketing email.

This file is self-contained: everything needed to build the first version is here. If something is missing, ask Eziz.

## Stack and repo layout

One Astro project deployed as one Cloudflare Worker. Use the current stable version of each package at setup time (check npm), TypeScript strict mode, and pnpm.

| Layer | Choice | Notes |
| --- | --- | --- |
| Framework | Astro with `@astrojs/cloudflare` adapter | Default static; data pages use `export const prerender = false` |
| Interactive UI | React islands (`client:load` / `client:visible`) | Only for search filters, save buttons, tracker, discussion forms |
| Styling | Plain CSS with CSS custom properties from `tokens.css` | No Tailwind; tokens come from the design system |
| Database | Cloudflare D1 + Drizzle ORM + drizzle-kit migrations | SQLite rules; index every filter column |
| Files | Cloudflare R2 | Logos, photos, PDFs, nightly D1 backups |
| Cache | Workers Cache API + KV for hot lists | Refresh on admin save |
| Auth | Better Auth with the Drizzle adapter on D1 | Telegram login, email one-time code, Google |
| Email | Cloudflare Email or Resend (open decision) | Sign-in codes and deadline reminders only |
| Scheduled jobs | Worker Cron Triggers | Reminders, backups, later Google Drive sync |
| Tests | Vitest (units), Playwright (key flows, phone + desktop) | Run in CI and before each milestone stop |
| Local dev | `wrangler dev` / `astro dev` with local D1 | Seed script for demo data |

**Folder layout**

```
clavis/
  CLAUDE.md            working rules for Claude Code
  SPEC.md              this spec
  astro.config.mjs
  wrangler.jsonc       D1, R2, KV bindings, cron triggers
  drizzle.config.ts
  src/
    styles/tokens.css  design tokens (light + dark)
    styles/base.css
    i18n/              tk.json, ru.json, en.json, helpers
    lib/db/            schema.ts, queries.ts, client.ts
    lib/auth/          Better Auth setup, Telegram verifier
    lib/cache.ts
    components/        Astro components (static)
    islands/           React components (interactive)
    layouts/           BaseLayout, AppShell (header / bottom bar)
    pages/[lang]/      all public and account routes
    pages/api/         JSON endpoints and auth routes
    pages/admin/       admin screens
  migrations/          generated SQL
  scripts/             seed.ts, import-supabase.ts, import-moe-list.ts
  tests/               unit + e2e
  public/              logo SVGs, favicon, app icon
```

## Data model

Programs sit at the centre: a university or a pathway college offers programs, a pathway joins a foundation or language program to a bachelor's, and scholarships cover programs. Every public record carries `last_checked`, `source_url` and `published`; only published records are shown.

| Table | Key columns | Notes |
| --- | --- | --- |
| `countries` | `code`, `popular_rank` | Names come from `translations` |
| `universities` | `id`, `slug`, `name`, `country_code`, `city`, `type`, `website`, `logo_key`, `ministry_status` (approved / not_listed / unchecked), `ministry_basis`, `ranking_qs`, `ranking_the`, `ranking_arwu`, `ranking_moscow`, `last_checked`, `source_url`, `published` | `ministry_basis` names the ranking and position that qualify it |
| `pathway_colleges` | `id`, `slug`, `name`, `country_code`, `city`, `website`, `last_checked`, `source_url`, `published` | Partner universities come through pathways |
| `programs` | `id`, `slug`, `provider_type` (university / college), `university_id`, `college_id`, `level` (bachelor / foundation / language), `name`, `field`, `language_of_study`, `duration_years`, `tuition_per_year_usd` (nullable), `intakes` (JSON), `requirements` (JSON: ielts_min, other tests, documents), `application_deadline` (nullable), `last_checked`, `source_url`, `published` | Exactly one of `university_id` / `college_id` |
| `pathways` | `id`, `from_program_id`, `to_program_id`, `entry_guaranteed` | `from` must be foundation or language, `to` must be bachelor; total years = sum of both durations, computed in queries |
| `scholarships` | `id`, `slug`, `name`, `provider`, `country_code`, `coverage` (full / partial), `covers` (JSON), `covers_pre_year` (yes / no / unknown), `amount_text`, `deadline` (nullable), `rolling`, `open_to_turkmen` (yes / no / unknown), `eligibility` (JSON checklist), `how_to_apply`, `last_checked`, `source_url`, `published` | Bachelor's-level only |
| `scholarship_programs` | `scholarship_id`, `program_id` | Many to many |
| `scholarship_universities` | `scholarship_id`, `university_id` | For scholarships valid for all programs at a university |
| `translations` | `entity_type`, `entity_id`, `lang`, `field`, `text` | Turkmen, Russian, English text for names and long fields |
| Better Auth tables | `user`, `session`, `account`, `verification` | Generated by Better Auth |
| `profiles` | `user_id`, `display_name`, `preferred_lang`, `quiz` (JSON), `reminder_channel` (email / telegram / none) | No age, no real name required |
| `saved_items` | `user_id`, `item_type` (program / university / scholarship), `item_id`, `created_at` | |
| `tracker_items` | `id`, `user_id`, `program_id`, `pathway_id`, `scholarship_id`, `stage` (planning / preparing / submitted / accepted / waitlisted / rejected / enrolled), `notes`, `updated_at` | A pathway is tracked as one item with two steps |
| `tracker_tasks` | `id`, `item_id`, `title`, `done`, `due_date`, `sort` | Pre-filled from the program's requirements |
| `share_links` | `token`, `user_id`, `scope` (tracker / item), `item_id`, `expires_at` | Read-only parent view |
| `reminder_log` | `tracker_item_id`, `days_before` (30 / 7 / 1), `sent_at` | Prevents duplicate reminders |
| `topics` | `slug`, `sort` | Six boards to start |
| `threads` | `id`, `topic_slug`, `title`, `body`, `author_id`, `university_id`, `program_id`, `lang`, `status` (open / hidden), `helped_reply_id`, `reply_count`, `last_activity_at` | |
| `replies` | `id`, `thread_id`, `author_id`, `body`, `helpful_count`, `status` | |
| `reply_votes` | `user_id`, `reply_id` | One helpful vote per user |
| `reports` | `id`, `target_type`, `target_id`, `reporter_id`, `reason`, `created_at` | Auto-hide after 3 reports |
| `user_badges` | `user_id`, `type` (studies_here / team), `university_id`, `verified_by`, `verified_at` | Admin-verified only |
| `mistake_reports` | `id`, `entity_type`, `entity_id`, `message`, `status`, `created_at` | From "Report a mistake" |
| `settings` | `key`, `value` | e.g. `usd_tmt_rate`, `usd_tmt_rate_date` |
| `audit_log` | `id`, `admin_id`, `action`, `entity_type`, `entity_id`, `diff`, `created_at` | Every admin write |

**Indexes (at minimum):** `programs(level, university_id)`, `programs(field)`, `programs(published, level)`, `universities(country_code, ministry_status)`, `scholarships(deadline)`, `threads(topic_slug, last_activity_at)`, `saved_items(user_id)`, `tracker_items(user_id)`. Every search query must use an index; no full-table scans on public pages.

## Routes and pages

Every public route lives under a language prefix (`/tk`, `/ru`, `/en`). `/` redirects to the saved language, else Turkmen. Pages that read the database render on the server and are cached; account pages are never cached.

| Route | Page | Rendering | Notes |
| --- | --- | --- | --- |
| `/[lang]` | Home | Server, cached 5 min | Signed in: next-deadline card on top |
| `/[lang]/search` | Search: Programs tab (default) and Universities tab | Server + filters island | Filters live in the URL query so results are shareable |
| `/[lang]/universities/[slug]` | University page | Server, cached | Tabs: Programs (first), Overview, Costs, Requirements, Scholarships, Discussion |
| `/[lang]/programs/[slug]` | Program page | Server, cached | Summary box, Your path (pathways), requirements, scholarships |
| `/[lang]/colleges/[slug]` | Pathway college page | Server, cached | Its foundation / language programs and where they lead |
| `/[lang]/scholarships` | Scholarship search | Server + filters island | Sorted by nearest deadline; closed hidden by default |
| `/[lang]/scholarships/[slug]` | Scholarship page | Server, cached | Eligibility checklist island; "Programs you can use it at" |
| `/[lang]/compare?ids=` | Compare up to 3 programs | Server | |
| `/[lang]/discussions` and `/[lang]/discussions/[topic]` | Topic boards and thread lists | Server, cached 1 min | |
| `/[lang]/discussions/[topic]/[thread]` | Thread page | Server, cached 1 min | Reply form island; signed-in actions |
| `/[lang]/my` | My Clav: Tracker (default), Saved, Profile | Server, no cache, auth required | |
| `/[lang]/my/tracker/[id]` | Tracker item detail | Server, no cache | Checklist, deadlines, notes |
| `/[lang]/share/[token]` | Read-only parent view | Server, no cache | No sign-in; noindex |
| `/[lang]/about`, `/[lang]/how-we-check`, `/[lang]/privacy` | Static content | Prerendered | |
| `/admin/...` | Admin | Server, no cache, admin role | See "Admin, data import and caching" |
| `/api/auth/*` | Better Auth handler | Server | |
| `/api/save`, `/api/tracker/*`, `/api/discussions/*`, `/api/report` | JSON endpoints for islands | Server | Validate with Zod; rate-limit writes |
| `/tg` | Telegram Mini App entry | Server | Verifies Telegram init data, signs in, redirects into `/[lang]` |

**Search filters (Programs tab):** country, level (bachelor's / foundation / language year), field, language of study, tuition per year (min / max, USD), bachelor's length (3 / 4 / 5+), total years with pre-year ("4 or less", "needs a pre-year", "direct entry only"), Ministry-approved only, has scholarships. Sort: relevance, tuition low to high, ranking, nearest deadline.

**Universities tab filters:** country, Ministry status, has foundation year, has scholarships.

## UI: tokens, components and layouts

Use only these tokens in CSS (`src/styles/tokens.css`), never raw hex in components. Light is the default; dark applies via `[data-theme="dark"]` and `prefers-color-scheme`, with a toggle in the profile.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--surface` | #FAF3E3 | #111B16 | Page background |
| `--surface-raised` | #FFFFFF | #1A2721 | Cards, sheets, inputs |
| `--ink` | #16261D | #F3ECDD | Main text |
| `--ink-muted` | #4A5A50 | #B4BFB7 | Secondary text |
| `--brand` | #234F3B | #7FBF98 | Primary buttons, links, focus, selected |
| `--on-brand` | #FAF3E3 | #0F1A14 | Text on brand fills |
| `--brand-soft` | #E3EDDD | #20382B | Badges like Ministry-approved, selected rows |
| `--accent` | #E4775A | #F0906F | Coral: the logo doorway, one highlight per screen; never text on light surfaces |
| `--on-accent` | #16261D | #16261D | Text on accent fills |
| `--border` | #DCD4C2 | #2E3D35 | Decorative dividers only |
| `--danger` | #B3261E | #F2B8B5 | Errors |

**Type:** Onest from Google Fonts (weights 400, 500, 600, 700; covers Latin Turkmen and Cyrillic). Styles: display 48/52 600, heading-1 32/38 600, heading-2 24/30 600, title 18/24 600, body 16/24 400, small 14/20 400, label 13/16 600. Body never below 16 px.

**Space and shape:** 4 px base (4, 8, 12, 16, 24, 32). Radius: 8 inputs and chips, 14 buttons and cards, 20 large cards and sheets, 999 badges. Touch targets at least 44 px.

**Logo (put in `public/`):** pointed iwan arch with a coral doorway on a threshold line. Wordmark: lowercase "clavis" in Onest 600, letter-spacing -0.02em.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path d="M10 52V32Q10 15 32 6Q54 15 54 32V52z" fill="#234F3B"/><path d="M19 52V33Q19 21 32 14Q45 21 45 33V52z" fill="#E4775A"/><rect x="6" y="52" width="52" height="4" rx="2" fill="#234F3B"/></svg>
```

On dark or green backgrounds, swap `#234F3B` for `#FAF3E3`. App icon: the cream mark on a `--brand` rounded square. Never add light rays or a floor spill under the door, and never recolor the doorway.

**Components to build** (Astro unless marked island):

| Component | Notes |
| --- | --- |
| `AppShell` | Desktop header (logo, Home, Universities, Scholarships, Discussions, My Clav, language switch, Sign in); phone bottom bar with the same 5 tabs, icon + label |
| `SearchBox` | 64 px tall, 2 px brand border, search icon, button flush to the right edge filling its full height |
| `FilterPanel` (island) | Left column on desktop, bottom sheet on phone; removable chips; live result count |
| `SegmentedTabs` | Programs / Universities switch on search |
| `ProgramCard`, `UniversityCard`, `ScholarshipCard` | 3 key facts each + save heart; program card shows total years when a pre-year applies |
| `MinistryBadge` | approved / not listed / not checked, each with a tap-to-explain popover |
| `SummaryBox` | Key answers + "Last checked [date] · Source · Report a mistake" |
| `PathSteps` | Numbered vertical steps (pre-year, then bachelor's) with "N years total" |
| `ProgramRow` | List row used on university and scholarship pages |
| `EligibilityChecklist` (island) | Ticks produce "Looks like a fit" or "Missing: …" |
| `SaveButton` (island) | Opens the sign-in sheet if signed out, then completes the save |
| `SignInSheet` (island) | Telegram, email code, Google; states why sign-in is needed |
| `TrackerBoard` (island) | Columns on desktop, grouped list with a stage dropdown on phone |
| `ThreadView`, `ReplyForm` (island) | Helped-me pin, Studies here badge, Report |
| `ShareWithParents` (island) | Creates a share link; uses Telegram share inside the Mini App |
| `EmptyState`, `Toast`, `CompareBar` | |

**Layouts:** Phone 360–430 px: one column, bottom bar. Desktop ≥1024 px: max content width 1200 px, 32 px side padding; search = filters column 260–300 px + results grid; detail pages = content column + sticky 340–380 px summary column on the right. Nothing on screen may be squeezed: give fixed-height controls `flex-shrink: 0`.

## Screens

Each screen top to bottom. Phone first; desktop differences after the arrow.

- **Home:** header (logo, language switch) → headline "Find your university and the money to study there" → `SearchBox` ("Program, university or field") → quick-start chips (Ministry-approved, Fully funded, Popular countries) → signed in: "Next deadline" card with progress bar → "Matches for you" (program cards) → Popular countries tiles → trust line ("Checked against the Ministry list · No ads · Free"). → Desktop: hero band with headline, search and chips on the left and the next-deadline card on the right; matches in a 3-column grid; 4 country tiles; "Deadlines coming up" and "New in Discussions" side by side; footer.
- **Search:** title "Search" → `SearchBox` + Filters button with count → `SegmentedTabs` Programs / Universities → removable filter chips → "[n] programs" + Sort → result cards → sticky compare bar when items are picked. → Desktop: filters as a left column (Level, Bachelor's length, Total years, Country, Ministry status, Cost, Field, Language, Funding), results in a 2-column grid, "Show more" button.
- **University page:** back arrow → campus photo → name, city and country → `SummaryBox` (Ministry badge + basis, cost per year USD and TMT, next deadline, English requirement, open scholarships, Last checked · Source) → Track this / Share with parents → tabs (Programs first) → programs grouped "Bachelor's" and "Foundation and language" as `ProgramRow`s. → Desktop: breadcrumb, wide photo, content column with tabs and level chips, sticky summary column on the right with Track, Save, Share, Official website.
- **Program page:** badges (level, Ministry-approved) → program name, university and place → `SummaryBox` (duration, tuition, taught in, next intake, total path, deadline) → "Your path" with a With foundation / Direct entry switch and `PathSteps` (1 Foundation year · 1 yr → 2 Bachelor's · 3 yrs → "4 years total") → scholarships for this program → Track this path + save. → Desktop: breadcrumb, path card in the content column with requirements and "What you'll study", sticky summary on the right.
- **Scholarship page:** badges (Full coverage, Bachelor's, Open to Turkmen citizens) → name and provider → `SummaryBox` (covers, pre-year included or not, amount, deadline with "in N days", official page) → `EligibilityChecklist` → "Programs you can use it at" → How to apply steps → Track this + save. → Desktop: content left, summary + checklist + actions in the right column.
- **Discussion thread:** question card (topic tag, Answered badge, title, body, author · time · replies) → pinned "Helped the asker" reply with Studies here badge → other replies (Helpful, Reply, Report) → reply box fixed at the bottom. → Desktop: topics list and Ask a question on the left, thread in the middle, Similar questions and Discussion rules on the right.
- **My Clav › Tracker:** tabs Tracker / Saved / Profile → stage filter chips with counts → items grouped by stage, each with a stage dropdown, deadline and progress bar → Share progress with parents. → Desktop: title row with Share and "+ Add application", next-deadline banner, 4 columns (Planning, Preparing, Submitted, Decision) with drag and drop.
- **Phone bottom bar on every screen:** Home, Universities, Scholarships, Discussions, My Clav.

## Accounts, tracker, discussions, reminders

Browsing never needs an account. Sign-in appears only when a student saves, tracks or posts, and the action they tried completes right after.

**Sign-in (Better Auth)**

- Order of buttons: Continue with Telegram, Continue with email (6-digit code, 10-minute expiry), Continue with Google.
- Telegram: on the website use the Telegram Login Widget; inside the Mini App, verify `initData` on the server with the bot token (HMAC check, reject data older than 24 hours) and sign in silently.
- One user can link all three methods. Sessions last 30 days, in httpOnly secure cookies.
- Roles: `student` (default), `admin`. Admin is set by hand in the database.

**Quick questions (no account)**

- Four questions: countries of interest, field, budget per year, English test and score. Stored in `localStorage` (wrapped in try/catch); copied to `profiles.quiz` on sign-in. They drive "Matches for you" on Home.

**Tracker**

- "Track this" on a program, pathway or scholarship creates a `tracker_items` row in stage `planning` and pre-fills `tracker_tasks` from the record's requirements (documents, tests, essays, fees).
- Stages: planning → preparing → submitted → accepted / waitlisted / rejected → enrolled. Desktop: drag between columns plus a stage menu on each card. Phone: grouped list with a stage dropdown.
- Progress shows as "4 of 7 done". Deadlines come from the program or scholarship and can be overridden per item.
- Share with parents: creates a `share_links` token (90-day expiry, revocable) for a read-only page in the parent's chosen language.

**Reminders (cron, daily at 09:00 Asia/Ashgabat)**

- For each open tracker item with a deadline 30, 7 or 1 day away, send one reminder by the user's channel (email or Telegram bot message), logged in `reminder_log` so it is never sent twice.
- No other emails or messages, ever.

**Discussions**

- Six topic boards: Choosing a country, Scholarships, Documents and visas, Tests (IELTS, SAT), Life abroad, For parents.
- Threads can be tagged with a university or program; those show on that page's Discussion tab.
- While typing a title, show up to 5 similar threads (D1 FTS5 search) to cut duplicates.
- The asker marks one reply "Helped me"; it is pinned under the question and the thread gets an "Answered" badge.
- Badges: "Studies here" (admin-verified per university) and "Clavis team".
- Report on every post; 3 reports hide it until an admin reviews. Rate limits: 5 threads and 30 replies per user per day. Bodies are plain text with line breaks and links (no HTML); links get `rel="nofollow ugc"`.
- Rules shown beside the form: no paid agent ads, no selling essays, no phone numbers or personal contacts in public posts.

## Admin, data import and caching

Admins edit everything in `/admin`, and changes show on the site within seconds, with no rebuild. Which real data goes in first is **not decided yet**, so the build ships with demo data and importers that can be run later.

**Admin screens**

- Lists with search and filters for universities, pathway colleges, programs, pathways and scholarships; an edit form for each, with all three languages side by side.
- A record can only be published with a `source_url`; saving sets `last_checked` to today unless changed by hand. Records older than 12 months are flagged.
- Ministry status editor: status, basis (which ranking and position), and the four ranking columns.
- Queues: mistake reports, reported posts, "Studies here" badge requests.
- Settings: USD to TMT rate and its date. Audit log of every admin write.
- Logo and photo upload to R2 (resized to 128 px logos and 1200 px photos, WebP).

**Data import (scripts, run by hand)**

- `scripts/seed.ts`: about 30 clearly fake demo records ("Demo University 1" and so on) across 4 countries, with bachelor's, foundation and language programs, pathways and scholarships. Never loaded into production.
- `scripts/import-supabase.ts`: reads a JSON or CSV export of the old UniPath tables, maps fields to the new schema, imports everything as **unpublished** drafts, and prints a report of unmapped fields. Never publishes automatically.
- `scripts/import-moe-list.ts`: reads the Ministry approved list (CSV: university name, country, ranking source, position) and matches it to universities, writing a review list for unmatched names.
- Later milestone: a cron job that pulls updates from a Google Drive sheet into drafts. Out of scope for the first build.

**Caching**

- Public server pages are cached in the Workers Cache API with a key that includes route, language, query string and a `data_version` number kept in KV.
- Every admin save increments `data_version`, so all cached pages refresh on their next view. No manual purging.
- Search result lists also cache for 60 seconds per query. Account pages, share pages and admin are never cached.
- Keep D1 use well under the free plan's daily limits: indexed queries only, cached pages, and no per-request counting queries on public pages.

**Backups:** a nightly cron exports D1 to R2 (`backups/YYYY-MM-DD.sql`), keeping the last 30.

## Languages, accessibility, performance, security

These rules apply to every milestone; a milestone isn't done if it breaks one.

**Languages**

- UI strings live in `src/i18n/{tk,ru,en}.json` with the same keys; a test fails if any key is missing in one file.
- Record text comes from `translations`; if a language is missing, show English with a small "Not translated yet" label.
- Dates and numbers use `Intl` for the page language. Costs show USD, with TMT beside it using the rate and date from `settings`.
- Layouts must survive labels about 30% longer than English (Russian and Turkmen); no fixed-width buttons.
- Each page sets `<html lang>` and `hreflang` alternates for the three languages.

**Accessibility**

- Text contrast at least 4.5:1 in both themes (the tokens already pass). Coral is never used for text on light surfaces.
- Real `<button>`, `<a href>`, `<input>` with `<label>`; full keyboard use; visible focus ring in `--brand`.
- Badges and statuses carry text, not colour alone. Icon-only buttons have `aria-label`.
- Respect the phone's text size and `prefers-reduced-motion`.

**Performance (slow and filtered networks)**

- Pages work as plain HTML before JavaScript loads; islands hydrate `client:visible` where possible.
- Budget per page: under 200 KB transferred before images, under 60 KB of JavaScript. First content visible in under 2 seconds on a throttled Slow 3G phone profile (checked with Playwright + Lighthouse).
- Images lazy-load, served as WebP from R2 with width and height set. Fonts: Onest with `font-display: swap`, only the weights used.
- No third-party scripts or trackers. If analytics are added later, use Cloudflare Web Analytics only.

**Security and privacy**

- All write endpoints check the session, validate input with Zod, and are rate-limited per user and IP.
- CSRF protection on forms; strict Content-Security-Policy; no inline scripts except Astro's own.
- Secrets (bot token, Google client secret, email key) only in Wrangler secrets, never in the repo.
- Store the minimum: no age, no real name, no phone number. A user can delete their account and all their data from Profile.
- Share pages and account pages send `noindex`.

## Milestones

Nine milestones, built in order. At the end of each one, stop, run the checks, and report: what was built, how to try it locally, what's left, and any question that blocks the next milestone. Don't start the next one until Eziz says go.

1. **M0 · Project setup.** Astro + Cloudflare adapter, `wrangler.jsonc` with local D1, R2 and KV bindings, TypeScript strict, pnpm, ESLint + Prettier, Vitest, Playwright, GitHub Actions workflow (lint, typecheck, test). `tokens.css` with light and dark, Onest, base styles, `AppShell` (desktop header + phone bottom bar), language routing for `/tk`, `/ru`, `/en`, i18n files, logo files in `public/`.
    - Check: `pnpm dev` shows an empty Home in all three languages, in light and dark, at 390 px and 1440 px widths; CI passes.
2. **M1 · Data layer.** Drizzle schema and migrations for every table in the data model, indexes, query helpers (search programs, search universities, get program with pathways and total years, get scholarship with programs), and `scripts/seed.ts` with the demo data.
    - Check: migrations apply to an empty local D1; seed runs; unit tests cover total years, pathway rules (from = pre-year, to = bachelor's) and the filters.
3. **M2 · Public browsing.** Home, Search (Programs tab default + Universities tab, filters in the URL), University, Program (with Your path), Pathway college, Scholarship search and page, Compare, About / How we check / Privacy. Ministry badge with explanation, Summary boxes with Last checked and Source, Report a mistake form, caching with `data_version`.
    - Check: Playwright walks first visit, find a program, find a scholarship on phone and desktop; pages render with JavaScript off; Lighthouse performance 90+ on Slow 3G profile.
4. **M3 · Accounts.** Better Auth with email code first, then Telegram Login Widget and Google; `SignInSheet`, `SaveButton` that resumes the action after sign-in, quick questions + Matches for you, My Clav › Saved and Profile (language, theme, reminder channel, delete account).
    - Check: sign in with each method locally (Google and Telegram need test credentials from Eziz; ask, don't guess); save resumes after sign-in; deleting an account removes all its rows.
5. **M4 · Tracker.** Track this on program, pathway and scholarship; pre-filled tasks; board on desktop and list on phone; item detail; share links + read-only parent page; reminder cron sending email at 30 / 7 / 1 days.
    - Check: e2e test tracks a pathway, ticks tasks, changes stage, opens the share link signed out; a cron test sends each reminder once.
6. **M5 · Discussions.** Topics, thread lists, thread page, ask and reply, Helped me, helpful votes, similar threads while typing (FTS5), tags to university or program, reports with auto-hide, rate limits, rules box.
    - Check: e2e test asks, replies, marks Helped me; 3 reports hide a post; rate limit returns a clear error.
7. **M6 · Telegram Mini App.** `/tg` entry, server-side `initData` check, silent sign-in, language from Telegram, Telegram back button and theme hooks, share via Telegram, Telegram reminder messages from the bot.
    - Check: unit tests for `initData` verification (valid, tampered, expired); manual test steps written for Eziz.
8. **M7 · Admin and import.** `/admin` CRUD for all records with three-language fields, publish rules, Ministry status editor, queues (mistakes, reports, badges), uploads to R2, settings, audit log, import scripts (Supabase export, Ministry list), nightly backups.
    - Check: an admin edit shows on the public page on next load without a rebuild; import scripts produce unpublished drafts and a report; backup file appears in local R2.
9. **M8 · Launch hardening.** Performance and accessibility pass (axe has no serious issues), security headers and CSP, sitemap and hreflang, 404 and error pages, production `wrangler` environment, and a `DEPLOY.md` with exact steps for Eziz (create D1, R2, KV, secrets, deploy, domain).
    - Check: all tests pass; a production build deploys to a preview Worker; DEPLOY.md is complete.

## Open decisions (ask Eziz when you reach them)

- Which real data goes in first, and which countries come first.
- Whether to import the old UniPath records at all, or only after review.
- Domain name.
- Email sender for sign-in codes and reminders (Resend or Cloudflare Email).
- Telegram bot name and username.
- How to verify "Studies here" badges.
- Compare in the first version, or later.
