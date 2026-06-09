# UniPath

University search and application platform for Turkmen students. Students discover universities abroad, track applications, and understand the MoE tuition transfer process.

**Live:** [unipathtm.vercel.app](https://unipathtm.vercel.app)

> UniPath is a **guide platform only** — it never handles money or embeds admission portals.

## Features

- University search and filtering (country, language, ranking, MoE approval)
- Side-by-side university comparison
- Tuition transfer guide and calculator (MoE-regulated, $12k/year cap)
- Scholarship listing with deadlines and eligibility details
- Student application tracker (auth-required)
- Multilingual: Turkmen (`tk`), Russian (`ru`), English (`en`)

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript strict |
| Styling | Tailwind CSS + shadcn/ui |
| Database | PostgreSQL via Supabase |
| Auth | Supabase Auth (email + Google OAuth) |
| i18n | next-intl (`tk` · `ru` · `en`) |
| Hosting | Vercel + Supabase |

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

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon (public) key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key — server-side only, never exposed to the client |

## Project Structure

```
unipath/
├── app/
│   ├── [locale]/               # All user-facing routes (tk / ru / en)
│   │   ├── page.tsx            # Home / search
│   │   ├── universities/       # Listing and detail pages
│   │   ├── compare/            # Side-by-side comparison
│   │   ├── transfer/           # Tuition transfer guide and calculator
│   │   ├── scholarships/       # Scholarship listing and detail
│   │   ├── tracker/            # Application tracker (auth-required)
│   │   └── support/            # Help / support
│   └── admin/                  # Admin panel (separate auth, no locale prefix)
│       ├── universities/       # CRUD + CSV import
│       ├── scholarships/       # CRUD + CSV import
│       ├── admins/             # Admin user management (superuser only)
│       └── logs/               # Audit log viewer (superuser only)
├── components/
│   ├── ui/                     # shadcn/ui base components
│   ├── university/             # University cards, filters, detail
│   ├── scholarship/            # Scholarship cards and detail
│   ├── transfer/               # Calculator, MoE badge, guide steps
│   ├── admin/                  # Admin forms, CSV importers, tables
│   └── checklist/              # Student document checklist
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

## Deployment

The app is deployed on **Vercel**. Pushing to `main` triggers an automatic production deploy — no manual steps required.

Live URL: **[unipathtm.vercel.app](https://unipathtm.vercel.app)**

CI runs on every push and PR (`.github/workflows/test.yml`): it installs dependencies and runs the full test suite. A failing CI blocks merge.

## Admin Panel

The admin panel lives at `/admin` (no locale prefix). It is completely separate from the public site and uses its own authentication.

### Roles

| Role | Capabilities |
|---|---|
| `admin` | Manage universities and scholarships (create, edit, delete, CSV import) |
| `superuser` | Everything admins can do, plus: manage admin accounts, view audit logs |

### Getting Admin Access

**The admin panel is invite-only.** To request access, contact the maintainer:

- Email: [eagamyradovv@gmail.com](mailto:eagamyradovv@gmail.com)
- Instagram: find the link on the maintainer's [GitHub profile](https://github.com/ez1z)

The maintainer will create an account for you in the Supabase `admins` table.

### Admin Sign-In

Go to `/admin/signin` and enter the email + password provided to you. There is no self-registration for admin accounts.

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

## Contributing

### Before You Start

1. Check [open issues](../../issues) or open one to discuss your change first.
2. Fork the repo, create a feature branch from `main`.
3. Follow the coding standards below.
4. Add or update tests for any changed behaviour.
5. Open a PR — CI must pass before review.

### Coding Standards

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

| Rule | Detail |
|---|---|
| Exchange rate | **3.51 TMT = 1 USD** (Central Bank of Turkmenistan, fixed) — always import from `lib/constants.ts`, never hardcode |
| Transfer cap | **$12,000 USD / year** per student — never add UI that bypasses this |
| Currency display | Always show **both** TMT and USD wherever a monetary value appears |
| MoE approval | `universities.moe_approved` is **admin-only** — never expose a user path to set it |
| MoE badge | Always render an "MoE Approved" badge when `moe_approved = true` |
| Transfer filter | "Transfer eligible" search must query `moe_approved = true` only |

### Out of Scope

Do not build or accept PRs for:

- Payment or money-transfer processing
- Visa application processing
- Embedding university admission portals (link out only)
- Any feature that bypasses the $12k transfer cap

## Database Schema (Key Tables)

```sql
universities (
  id                      uuid primary key,
  name_en                 text,
  name_ru                 text,
  name_tk                 text,
  country                 text,
  city                    text,
  tuition_usd             numeric,
  moe_approved            boolean,
  ranking_qs              integer,
  languages               text[],
  majors                  text[],
  official_website        text,
  application_portal_url  text,
  entrance_requirements   jsonb,   -- {"turkey": {"yos": true, "quota": true}, ...}
  created_at              timestamptz
)

admins (
  id      uuid references auth.users(id),
  email   text,
  role    text   -- 'admin' | 'superuser'
)
```

After inserting or updating university records, revalidate the listing path:

```ts
revalidatePath('/universities');
```

## License

Apache License 2.0 — see [LICENSE](LICENSE) for the full text.
