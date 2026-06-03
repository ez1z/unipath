# UniPath

University search and application platform for Turkmen students. Students discover universities abroad, track applications, and understand the MoE tuition transfer process.

> UniPath is a **guide platform only** — it never handles money or embeds admission portals.

## Features

- University search and filtering (country, language, ranking, MoE approval)
- Side-by-side university comparison
- Tuition transfer guide and calculator (MoE-regulated, $12k/year cap)
- Multilingual: Turkmen (`tk`), Russian (`ru`), English (`en`)

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript strict |
| Styling | Tailwind CSS + shadcn/ui |
| Database | PostgreSQL via Supabase |
| Auth | Supabase Auth (email + social) |
| i18n | next-intl |
| Hosting | Vercel + Supabase |

## Getting Started

```bash
git clone https://github.com/your-org/unipath
cd unipath
npm install
cp .env.example .env.local   # fill in your Supabase URL and anon key
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment Variables

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server-side only) |

## Project Structure

```
unipath/
├── app/
│   ├── [locale]/           # All routes are i18n-aware (tk / ru / en)
│   │   ├── page.tsx        # Home / search
│   │   ├── universities/   # Listing and detail pages
│   │   ├── compare/        # Side-by-side comparison
│   │   ├── transfer/       # Tuition transfer guide and calculator
│   │   └── community/      # Student forum
│   └── api/
├── components/
│   ├── ui/                 # shadcn/ui base components
│   ├── university/         # University cards, filters, detail
│   └── transfer/           # Calculator, MoE badge, guide steps
├── lib/
│   ├── supabase/           # DB client, queries, types
│   ├── i18n/               # Translation files (tk, ru, en)
│   └── constants.ts        # Exchange rate, transfer cap, locales
└── types/                  # Shared TypeScript types
```

## Contributing

### Before You Start

1. Check [open issues](../../issues) or open one to discuss your change first.
2. Fork the repo, create a feature branch from `main`.
3. Follow the coding standards below.
4. Open a PR — CI must pass before review.

### Coding Standards

- **TypeScript strict** — no `any`, no `ts-ignore` without an explanatory comment
- **Server Components by default** — only add `'use client'` for interactivity or browser APIs
- **Zod** for all API input and form validation
- **No raw SQL** — use the Supabase query builder or typed RPC functions
- **i18n** — every user-facing string via `useTranslations()`, never hardcoded; add all three locales (`tk`, `ru`, `en`)
- **Accessibility** — all interactive elements must have ARIA labels
- **Error boundaries** on every page-level component
- **Loading states** — `loading.tsx` for route-level, `Suspense` for component-level

### Domain Rules — Must Read

These rules reflect real-world legal and regulatory constraints. Do not work around them:

| Rule | Detail |
|---|---|
| Exchange rate | **3.51 TMT = 1 USD** (Central Bank of Turkmenistan, fixed) — always import from `lib/constants.ts` |
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

## Database Schema (Key Table)

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
  entrance_requirements   jsonb,
  created_at              timestamptz
)
```

After inserting or updating university records, revalidate the listing path:

```ts
revalidatePath('/universities');
```

## License

Apache License 2.0 — see [LICENSE](LICENSE) for the full text.
