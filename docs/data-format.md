# Clavis import files

Real records go into Clavis in one of two ways: typed into `/admin`, or written
as a JSON file and imported with a script. This page describes that file
(format `clavis-records/1`). A person or an AI assistant can write it from the
official pages of universities and scholarship providers.

- Machine-readable schema: [`records.schema.json`](records.schema.json). Editors
  such as VS Code check a file against it when the file starts with
  `"$schema": "../records.schema.json"` (adjust the path).
- A complete example with every field: [`examples/records.example.json`](examples/records.example.json).

## What an import does

- Every record is created as an **unpublished draft**. Nothing appears on the
  site until an admin opens the draft in `/admin`, checks it and ticks Published.
- A record whose `slug` already exists is **skipped**, never changed. Use
  `/admin` to change existing records.
- The whole file is checked first. If anything is wrong (a missing field, an
  unknown country, a slug that points nowhere), **nothing** is imported and
  every problem is listed with where it is, for example
  `programs[3].university: no university "demo-uni"`.
- Each created record gets an audit-log row (action `import`) with the file
  name and the file's `source` text.

## Running it

```sh
pnpm db:import my-records.json --dry-run   # check only, write nothing
pnpm db:import my-records.json             # import into the local D1
pnpm db:import my-records.json --sql out.sql
```

`--sql` writes SQL statements instead of touching any database, for loading
into production (see DEPLOY.md). Ids are looked up by slug inside the SQL. The
report lists the countries and slugs the file expects to find in the target
database; if one is missing, or one of the new slugs already exists there, the
database refuses the file.

## Rules for the facts

These are the same rules the site follows:

- **Unknown stays unknown.** Leave a field out (or set it to `null`) when the
  official page doesn't say. Never estimate tuition, deadlines or scores. The
  site then shows "Cost not confirmed", "Deadline not confirmed" and so on.
- **Say where it came from.** `source_url` is the page the facts were checked
  on. A record can't be published without one.
- **Say when.** `last_checked` is the day the facts were checked (YYYY-MM-DD).
  It defaults to the import day.
- **Ministry status.** Use `"approved"` only when the Ministry's list includes
  the university, and say which list and position in `ministry_basis`. If you
  haven't checked, leave `ministry_status` out (it becomes `"unchecked"`).
- **Names in three languages.** `name.en` is required; `name.tk` (Turkmen) and
  `name.ru` (Russian) are optional. Missing translations show as "Not
  translated yet" with the English name.
- Don't add advice of any kind, including about how to report study years.

## The file

```json
{
  "$schema": "../records.schema.json",
  "format": "clavis-records/1",
  "source": "Official pages, checked by …",
  "universities": [],
  "colleges": [],
  "programs": [],
  "pathways": [],
  "scholarships": []
}
```

Every list is optional. Unknown fields are refused, so a typo can't be
silently lost.

### Slugs

A slug is the record's address on the site and the way records point at each
other: lowercase letters, digits and dashes, such as
`istanbul-example-university` or `istanbul-example-university-computing-bsc`.
It must be unique for its type. A reference may point at a record in the same
file or one already in Clavis.

### universities

| Field                        | Required        | Meaning                                                                    |
| ---------------------------- | --------------- | -------------------------------------------------------------------------- |
| `slug`                       | yes             |                                                                            |
| `name`                       | yes             | `{ "en": …, "tk": …, "ru": … }`                                            |
| `country`                    | yes             | Two-letter code of a country already in Clavis (`TR`, `RU`, `HU`, `GB`, …) |
| `city`                       | yes             |                                                                            |
| `type`                       |                 | `public` or `private`                                                      |
| `website`                    |                 | Full `https://` address                                                    |
| `ministry_status`            |                 | `approved`, `not_listed` or `unchecked` (default)                          |
| `ministry_basis`             | with `approved` | e.g. `QS 2026, position 512`                                               |
| `rankings`                   |                 | `{ "qs", "the", "arwu", "moscow" }`: positions as whole numbers            |
| `source_url`, `last_checked` |                 | See above                                                                  |

### colleges

Pathway colleges that teach foundation years (not universities).

| Field                                   | Required | Meaning             |
| --------------------------------------- | -------- | ------------------- |
| `slug`, `name`, `country`, `city`       | yes      | As for universities |
| `website`, `source_url`, `last_checked` |          |                     |

### programs

| Field                        | Required        | Meaning                                                                                                                                                                    |
| ---------------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `slug`, `name`               | yes             |                                                                                                                                                                            |
| `university` or `college`    | exactly one     | Slug of who teaches it                                                                                                                                                     |
| `level`                      | yes             | `bachelor`, `foundation` or `language` (language year)                                                                                                                     |
| `field`                      |                 | One of `business`, `computing`, `engineering`, `medicine`, `law`, `sciences`, `social_sciences`, `arts`, `education`, `architecture`. Not for language years               |
| `language_of_study`          | yes             | Two-letter code, e.g. `en`, `tr`, `ru`                                                                                                                                     |
| `duration_years`             | yes             | e.g. `4`, `1`, `1.5`                                                                                                                                                       |
| `tuition_per_year_usd`       |                 | Whole US dollars a year; leave out if not confirmed                                                                                                                        |
| `intakes`                    |                 | Start months, e.g. `[9, 2]` for September and February                                                                                                                     |
| `application_deadline`       |                 | YYYY-MM-DD                                                                                                                                                                 |
| `pre_year_required`          | bachelor's only | `yes` (no direct entry from a Turkmen school certificate), `no`, or `unknown` (default)                                                                                    |
| `requirements.ielts_min`     |                 | e.g. `6.5`                                                                                                                                                                 |
| `requirements.other_tests`   |                 | `[{ "name": "SAT", "min": "1200" }]`                                                                                                                                       |
| `requirements.documents`     |                 | Any of `passport`, `school_certificate`, `transcript`, `motivation_letter`, `recommendation_letter`, `cv`, `portfolio`, `medical_certificate`, `photos`, `application_fee` |
| `source_url`, `last_checked` |                 |                                                                                                                                                                            |

### pathways

A foundation or language program that leads to a bachelor's.

| Field              | Required | Meaning                                          |
| ------------------ | -------- | ------------------------------------------------ |
| `from`             | yes      | Slug of a `foundation` or `language` program     |
| `to`               | yes      | Slug of a `bachelor` program                     |
| `entry_guaranteed` |          | `true` only if the university says so in writing |

### scholarships

| Field                        | Required | Meaning                                                           |
| ---------------------------- | -------- | ----------------------------------------------------------------- |
| `slug`, `name`               | yes      |                                                                   |
| `provider`                   | yes      | Who gives it                                                      |
| `country`                    | yes      | Where it is used                                                  |
| `coverage`                   | yes      | `full` or `partial`                                               |
| `covers`                     |          | Any of `tuition`, `stipend`, `housing`, `flights`, `insurance`    |
| `covers_pre_year`            |          | `yes`, `no`, `unknown` (default)                                  |
| `amount_text`                |          | `{ "en": "€1,200 a month" }`, as the provider says it             |
| `deadline`                   |          | YYYY-MM-DD; leave out with `rolling`                              |
| `rolling`                    |          | `true` when applications are taken all year                       |
| `open_to_turkmen`            |          | `yes`, `no`, `unknown` (default)                                  |
| `eligibility`                |          | `{ "en": ["condition", …], "tk": […], "ru": […] }`                |
| `how_to_apply`               |          | `{ "en": …, "tk": …, "ru": … }`                                   |
| `programs`                   |          | Slugs of bachelor's programs it can be used at                    |
| `universities`               |          | Slugs of universities where it works for every bachelor's program |
| `source_url`, `last_checked` |          |                                                                   |

## The Ministry's approved list

`pnpm db:import-moe list.csv` reads the Ministry's list as CSV with four
columns (a first row of column names is fine):

```csv
University name,Country,Ranking source,Position
Example University,TR,QS,512
```

- Country: a two-letter code or the country's name in English, Turkmen or Russian.
- Ranking source: QS, THE, ARWU (Shanghai) or Moscow International (MosIUR).
- A row matches when exactly one university in that country has that name
  (case, accents and punctuation ignored, in any of the three languages). It is
  set to `approved` with basis `QS 512` and the ranking column filled.
- Dry run by default. `--apply` changes the local D1; `--sql out.sql` writes
  the updates for another database.
- Rows that need a person (no match, two matches, unknown country, unknown
  ranking, unreadable position) go to `list.review.csv`, with close names
  where there are any. Fix the name in `/admin`, or add the university, and run
  it again. Nothing is guessed.
