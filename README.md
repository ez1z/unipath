# UniPath

University search and application platform for Turkmen students. Students discover universities abroad, track applications, and understand the MoE tuition transfer process.

**Live:** [unipathtm.vercel.app](https://unipathtm.vercel.app)

> UniPath is a **guide platform only** — it never handles money or embeds admission portals.

## Features

### Public Features
- **University search and filtering** — by country, language, ranking, MoE approval
- **Side-by-side university comparison** — compare tuition, entrance requirements, scholarships
- **Tuition transfer guide and calculator** — MoE-regulated, $12k/year cap, dual-currency display
- **Scholarship listing** — deadlines, eligibility, coverage types, filtered by university
- **MoE-Approved universities page** — official list of universities approved for tuition transfers, with cross-referencing to UniPath catalog
- **Student application tracker** (auth-required) — bookmark universities, track applications, manage document checklists
- **Student profiles** — save preferences, track application progress, view personalized recommendations
- **AI Assistant** — Gemini-powered chat widget grounded in live university and scholarship data; provides guidance in user's selected locale
- **Support & FAQ** — help section with platform guidance and contact information
- **Multilingual interface** — Turkmen (`tk`), Russian (`ru`), English (`en`)

### Admin Features
- **University management** — create, edit, delete, bulk import via CSV
- **Scholarship management** — create, edit, delete, bulk import via CSV; link to universities
- **Admin user management** (superuser only) — manage admin accounts, assign roles
- **Analytics dashboard** (superuser only) — track visits, signups, AI chat usage, popular universities/scholarships
- **System logs** (superuser only) — view error logs and system events
- **Audit trail** — all admin actions are logged

## Tech Stack

| Layer     | Technology                           |
| --------- | ------------------------------------ |
| Framework | Next.js 14 (App Router)              |
| Language  | TypeScript strict                    |
| Styling   | Tailwind CSS + shadcn/ui             |
| Database  | PostgreSQL via Supabase              |
| Auth      | Supabase Auth (email + Google OAuth) |
| i18n      | next-intl (`tk` · `ru` · `en`)       |
| Hosting   | Vercel + Supabase                    |

## Getting Started

```bash
git clone https://github.com/your-org/unipath
cd unipath
npm install
cp .env.example .env.local   # fill in your Supabase credentials
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment Variables

**Required:**

| Variable                        | Description                                                      |
| ------------------------------- | ---------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase project URL                                             |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon (public) key                                       |
| `SUPABASE_SERVICE_ROLE_KEY`     | Service role key — server-side only, never exposed to the client |

**For AI Assistant:**

| Variable          | Description                                                                     |
| ----------------- | ------------------------------------------------------------------------------- |
| `NVIDIA_API_KEY` | NVIDIA API key (server-only, never exposed to client). Free tier at build.nvidia.com. Leave blank to disable chat widget. |
| `NEXT_PUBLIC_SITE_URL` | Public URL of the deployed site (used for chat widget configuration) |

## Project Structure

```
unipath/
├── app/
│   ├── [locale]/               # All user-facing routes (tk / ru / en)
│   │   ├── page.tsx            # Home / search
│   │   ├── auth/               # Sign in / sign up
│   │   ├── universities/       # Listing and detail pages
│   │   ├── scholarships/       # Listing and detail pages
│   │   ├── compare/            # Side-by-side comparison
│   │   ├── transfer/           # Tuition transfer guide and calculator
│   │   ├── moe-approved/       # Official MoE-approved universities list
│   │   ├── tracker/            # Application tracker + profile (auth-required)
│   │   └── support/            # FAQ and help section
│   └── admin/                  # Admin panel (separate auth, no locale prefix)
│       ├── universities/       # CRUD + CSV import
│       ├── scholarships/       # CRUD + CSV import
│       ├── admins/             # Admin user management (superuser only)
│       ├── logs/               # Audit log viewer (superuser only)
│       ├── analytics/          # Analytics dashboard (superuser only)
│       ├── system-logs/        # System error logs (superuser only)
│       └── signin/             # Admin sign in
├── components/
│   ├── ui/                     # shadcn/ui base components
│   ├── university/             # University cards, filters, detail, entrance requirements
│   ├── scholarship/            # Scholarship cards, detail, listings
│   ├── transfer/               # Calculator, MoE badge, guide steps
│   ├── tracker/                # Application tracker, bookmarks, progress
│   ├── profile/                # Student profile, preferences, bookmarks
│   ├── checklist/              # Student document checklist per university
│   ├── chat/                   # AI assistant widget (Gemini-powered)
│   ├── analytics/              # Analytics tracking for usage data
│   ├── support/                # FAQ accordion and help section
│   ├── moe/                    # MoE-approved universities linking
│   └── admin/                  # Admin forms, CSV importers, tables, analytics charts
├── lib/
│   ├── supabase/               # Server / browser / service-role clients
│   ├── admin/                  # Admin auth helpers, audit logging
│   ├── data/                   # Data-fetching, filtering, type definitions
│   ├── i18n/                   # next-intl routing and request config
│   └── constants.ts            # Exchange rate, transfer cap, locales
├── messages/                   # Translation files: tk.json, ru.json, en.json
├── supabase/
│   └── migrations/             # SQL migration files (11 migrations)
└── tests/
    ├── unit/                   # Schema, utility, filter tests
    └── integration/            # Server action tests with mocked Supabase
```

## Database & Migrations

The database runs on **Supabase** (PostgreSQL). All schema changes go through migration files under `supabase/migrations/`.

**Migrations are applied exclusively by the repo owner** via GitHub Actions (`.github/workflows/migrate.yml`). Contributors should never run `supabase db push` against production. To propose a schema change:

1. Create the migration file locally: `supabase migration new <description>`
2. Write the SQL in the generated file
3. Include the migration in your PR and note it needs to be applied

The migration workflow is triggered manually (`workflow_dispatch`) and is restricted to the repo owner.

## Testing

Tests use **Vitest** and live in `tests/`.

```bash
npm test                          # run all tests once
npx vitest run tests/unit/csv-schema.test.ts   # run a single file
```

- `tests/unit/` — schema validation, utility functions, filtering logic
- `tests/integration/` — server actions tested with mocked Supabase clients

**When adding a feature or fixing a bug, add or update the relevant tests.** PRs that introduce new behaviour without test coverage will not be merged. For server actions, see `tests/integration/csv-import-action.test.ts` as a reference for the mocking pattern.

## AI Assistant

The platform includes an AI chatbot powered by **NVIDIA API** (Kimi K2.6 model) that provides personalized guidance to students. The assistant:

- **Answers questions** about universities, scholarships, and the tuition transfer process
- **Uses live catalog data** — grounding context is generated from the current database, so responses always reference current information
- **Respects domain rules** — enforces the $12k transfer cap, official exchange rates, and MoE regulations
- **Supports all locales** — responds in the user's selected language (Turkmen, Russian, or English)
- **Provides internal links** — suggests relevant pages within UniPath (universities, scholarships, transfer guide, etc.)

The chat widget appears as a floating button on public pages. Student questions are processed via a server action that:
1. Loads relevant universities/scholarships matching the query
2. Builds a grounding context from the catalog data
3. Sends the query to NVIDIA with domain-specific system prompts
4. Renders the response with Markdown and internal linking support

**Configuration:** Set `NVIDIA_API_KEY` in environment variables (free tier available at [build.nvidia.com](https://build.nvidia.com), no credit card required). Leave blank to disable the chat widget.

## Analytics

The **superuser analytics dashboard** (`/admin/analytics`) tracks:

- **Visits & trends** — page views over 7, 30, or 90 days
- **Signups** — new user registrations by date
- **Locale distribution** — user preference breakdown (Turkmen, Russian, English)
- **AI chat usage** — conversation volume and trends
- **Top universities** — most viewed, bookmarked, compared
- **Top scholarships** — most viewed, with deadline tracking
- **KPIs** — summary metrics: total visits, active users, universities, scholarships

Analytics events are tracked automatically via the `AnalyticsTracker` component and sent to the `analytics_events` table.

## Deployment

The app is deployed on **Vercel**. Pushing to `main` triggers an automatic production deploy — no manual steps required.

Live URL: **[unipathtm.vercel.app](https://unipathtm.vercel.app)**

CI runs on every push and PR (`.github/workflows/test.yml`): it installs dependencies and runs the full test suite. A failing CI blocks merge.

## Admin Panel

The admin panel lives at `/admin` (no locale prefix). It is completely separate from the public site and uses its own authentication.

### Roles

| Role        | Capabilities                                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------------- |
| `admin`     | Manage universities and scholarships (create, edit, delete, CSV import); view audit logs of own actions             |
| `superuser` | Everything admins can do, plus: manage admin accounts, view full audit logs, access analytics, view system logs     |

### Getting Admin Access

**The admin panel is invite-only.** To request access, contact the maintainer:

- Email: [eagamyradovv@gmail.com](mailto:eagamyradovv@gmail.com)
- Instagram: find the link on the maintainer's [GitHub profile](https://github.com/ez1z)

The maintainer will create an account for you in the Supabase `admins` table with the appropriate role.

### Admin Sign-In

Go to `/admin/signin` and enter the email + password provided to you. There is no self-registration for admin accounts.

### Admin Dashboard

Once signed in, admins see a dashboard with:

- **Quick links** to manage universities, scholarships, and admin accounts
- **Audit log** of recent actions (who did what and when)
- **Analytics** (superuser only) — usage trends, user engagement, AI assistant metrics
- **System logs** (superuser only) — error log viewer for debugging and monitoring

### Managing Universities and Scholarships

Once signed in, admins can:

- **List** all universities / scholarships in a table with search
- **Create** a new record using the form
- **Edit** an existing record
- **Delete** a record (with confirmation)
- **Bulk import** via CSV (see below)

All actions are recorded in an audit log accessible to superusers at `/admin/logs`.

### CSV Bulk Import

Both universities and scholarships support bulk import via CSV.

**Workflow:**

1. Go to `/admin/universities/import` (or `/admin/scholarships/import`)
2. Click **Download Template** to get a pre-filled CSV with the correct headers
3. Edit the CSV locally (Excel, Google Sheets, etc.)
4. Upload the file — the browser parses it with PapaParse and validates every row against a Zod schema
5. A preview table shows the first 10 rows; validation errors are highlighted in red
6. Click **Import** to send valid rows to the server, which upserts them into the database

**Upsert behaviour:**

- Universities: matched on `name_en` — existing rows are updated, new rows are inserted
- Scholarships: matched on a slug derived from `name_en` + `country`

**University CSV headers:**

```
name_en, name_ru, name_tk, country, city, tuition_usd, moe_approved,
ranking_qs, languages, majors, official_website, application_portal_url,
entrance_requirements, semesters
```

- `languages` and `majors`: pipe-separated values, e.g. `English|Russian`
- `entrance_requirements`: JSON string, e.g. `{"turkey":{"yos":true}}`
- `moe_approved`: `true` or `false`

**Scholarship CSV headers:**

```
name_en, name_ru, name_tk, country, university_name_en, type, coverage,
amount_usd, deadline_text, semesters, description_en, description_ru,
description_tk, application_url
```

## Student Features

### Application Tracker

Authenticated students can access `/[locale]/tracker` to:

- **Bookmark universities** — save universities of interest for quick reference
- **Compare bookmarks** — use the side-by-side compare tool on saved universities
- **Track applications** — manually record application status and dates for each university
- **View saved scholarships** — find relevant scholarships at bookmarked universities

### Student Profile & Preferences

At `/[locale]/tracker/profile`, students can:

- **Set preferences** — select target countries, languages, fields of study
- **Record test scores** — track standardized test results (IELTS, SAT, GRE, etc.) for entrance requirement matching
- **View recommendations** — see universities matching their criteria
- **Manage document checklist** — track required documents (transcript, test scores, essays) per university

### Document Checklist

For each bookmarked university, students can:

- **Create a to-do list** of required application documents (transcript, test scores, letters of recommendation, essays, etc.)
- **Check off completed items** as they gather documents
- **Add custom items** specific to the university's requirements
- **View progress** — percentage of documents completed

All checklist data is saved to the database and persists across sessions.

## Contributing

### Before You Start

1. Check [open issues](../../issues) or open one to discuss your change first.
2. Fork the repo, create a feature branch from `main`.
3. Follow the coding standards below.
4. Add or update tests for any changed behaviour.
5. Open a PR — CI must pass before review.

### Public Pages

### Universities & Comparison

- `/[locale]/universities` — searchable listing with filters (country, language, ranking, MoE-approved, tuition range)
- `/[locale]/universities/[slug]` — university detail page with entrance requirements, scholarships, student reviews, application link
- `/[locale]/compare` — side-by-side comparison of selected universities with tuition, rankings, languages, majors

### Scholarships & Financial Aid

- `/[locale]/scholarships` — searchable listing filtered by university, coverage type, deadline
- `/[locale]/scholarships/[slug]` — scholarship detail page with eligibility, deadline, application link

### Tuition Transfer & MoE

- `/[locale]/transfer` — guide to the official Turkmen MoE tuition transfer process, with interactive calculator
  - Shows both official (3.51 TMT/USD) and unofficial (19.6 TMT/USD) rates
  - Enforces $12,000 USD annual cap
  - Explains MoE-approved university requirement
- `/[locale]/moe-approved` — official list of universities approved by Turkmen Ministry of Education for tuition transfers
  - Cross-references universities in UniPath catalog
  - Provides admin tool to link unlisted universities (for superusers)

### Support & Help

- `/[locale]/support` — FAQ, platform guidance, contact information, glossary
- AI Assistant — available on all pages for real-time Q&A support

## Coding Standards

- **TypeScript strict** — no `any`, no `ts-ignore` without an explanatory comment
- **Server Components by default** — only add `'use client'` for interactivity or browser APIs
- **Zod** for all API input and form validation
- **No raw SQL** — use the Supabase query builder or typed RPC functions
- **i18n** — every user-facing string via `useTranslations()`, never hardcoded; add all three locales (`tk`, `ru`, `en`)
- **Accessibility** — all interactive elements must have ARIA labels
- **Error boundaries** on every page-level component
- **Loading states** — `loading.tsx` for route-level, `Suspense` for component-level
- **Tests** — new features and bug fixes must include relevant unit or integration tests

### Domain Rules — Must Read

These rules reflect real-world legal and regulatory constraints. Do not work around them:

| Rule             | Detail                                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------------------------ |
| Exchange rate    | **3.51 TMT = 1 USD** (Central Bank of Turkmenistan, fixed) — always import from `lib/constants.ts`, never hardcode |
| Transfer cap     | **$12,000 USD / year** per student — never add UI that bypasses this                                               |
| Currency display | Always show **both** TMT and USD wherever a monetary value appears                                                 |
| MoE approval     | `universities.moe_approved` is **admin-only** — never expose a user path to set it                                 |
| MoE badge        | Always render an "MoE Approved" badge when `moe_approved = true`                                                   |
| Transfer filter  | "Transfer eligible" search must query `moe_approved = true` only                                                   |

### Out of Scope

Do not build or accept PRs for:

- Payment or money-transfer processing
- Visa application processing
- Embedding university admission portals (link out only)
- Any feature that bypasses the $12k transfer cap

## Database Schema (Key Tables)

```sql
-- Main catalog tables
universities (
  id                      uuid primary key,
  slug                    text unique,
  name_en / name_ru / name_tk  text,
  country, city           text,
  tuition_usd             numeric,
  moe_approved            boolean,
  ranking_qs              integer,
  languages               text[],
  majors                  text[],
  official_website        text,
  application_portal_url  text,
  entrance_requirements   jsonb,   -- {"turkey": {"yos": true, "quota": true}, ...}
  tuition_options         jsonb,   -- min/max tuition figures by year
  acceptance_rate         numeric,
  created_at              timestamptz
)

scholarships (
  id                      uuid primary key,
  slug                    text unique,
  university_id           uuid references universities(id),
  name_en / name_ru / name_tk  text,
  country                 text,
  type                    text,    -- 'government' | 'merit' | 'need-based' | 'partial'
  coverage                text[],  -- 'tuition' | 'accommodation' | 'flights' | 'stipend' | 'health'
  amount_usd              numeric,
  deadline_text           text,
  description_en/ru/tk    text,
  application_url         text,
  is_active               boolean,
  created_at              timestamptz
)

-- Auth & users
profiles (
  id                      uuid primary key references auth.users(id),
  email                   text,
  preferred_countries     text[],  -- student preferences
  interested_scholarships uuid[],  -- bookmarked scholarships
  created_at              timestamptz
)

admins (
  user_id                 uuid primary key references auth.users(id),
  role                    text,    -- 'admin' | 'superuser'
  created_at              timestamptz
)

-- Student tracking
bookmarks (
  id                      uuid primary key,
  user_id                 uuid references auth.users(id),
  university_id           uuid references universities(id),
  created_at              timestamptz,
  unique (user_id, university_id)
)

document_checklists (
  id                      uuid primary key,
  user_id                 uuid references auth.users(id),
  university_id           uuid references universities(id),
  items                   jsonb,   -- [{id, name, is_checked}, ...]
  created_at              timestamptz
)

-- Admin tracking
audit_logs (
  id                      uuid primary key,
  admin_id                uuid references auth.users(id),
  action                  text,    -- 'created' | 'updated' | 'deleted'
  entity_type             text,    -- 'university' | 'scholarship' | 'admin'
  entity_id               uuid,
  changes                 jsonb,
  created_at              timestamptz
)

-- Analytics
analytics_events (
  id                      bigint primary key generated always as identity,
  event_type              text,    -- 'pageview' | 'university_view' | 'scholarship_view' | 'search' | 'ai_question'
  visitor_id              uuid,    -- anonymous cookie-based ID
  user_id                 uuid,    -- set when signed in
  path                    text,
  locale                  text,    -- 'tk' | 'ru' | 'en'
  entity_id               uuid,    -- university/scholarship ID
  search_query            text,
  ai_question             text,
  created_at              timestamptz
)

-- System monitoring
system_logs (
  id                      uuid primary key,
  level                   text,    -- 'error' | 'warn' | 'info'
  context                 text,    -- where the error occurred
  message                 text,
  details                 jsonb,
  created_at              timestamptz
)
```

### Key Patterns

**Revalidation:** After inserting or updating universities or scholarships, revalidate paths:

```ts
revalidatePath('/universities');
revalidatePath('/scholarships');
```

**Analytics RPCs:** The analytics_events table is queried via aggregation functions (e.g., `analytics_top_universities()`, `analytics_visits_daily()`) — these are stable SQL functions executed server-side.

**Audit Trail:** All admin actions (create, edit, delete) are logged to audit_logs via server actions before the mutation.

**RLS:** analytics_events and system_logs use RLS with no select/insert policies — only the service role (superuser admin UI and tracking endpoints) can access them.

## License

see [LICENSE](LICENSE) for the full text.
