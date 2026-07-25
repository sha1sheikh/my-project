# Register of Advocacy & Lobbying Organisations

A static, source-first, searchable public directory of advocacy and lobbying
**organisations** active in UK higher education, built to expand into other
sectors (health, public affairs, security, media, politics).

This register covers organisations only. There is no person or individual
entity anywhere in the data model — no name fields for individuals, no
officer/trustee data, no named individuals in any claim or activity text.
See [`/methodology`](src/pages/methodology.astro) for the full editorial
policy.

## Stack

- [Astro](https://astro.build) (static output) + TypeScript + Tailwind CSS v4
- Data as YAML files in `/data`, validated with [Zod](https://zod.dev)
  (schemas in `src/schemas.ts`, wired into Astro content collections via
  `src/content.config.ts`)
- [Pagefind](https://pagefind.app) for client-side search, built as a
  post-build step
- Deploy target: Netlify (static site + one serverless function for the
  moderation queue) — also works on any static host if the `/submit` form's
  serverless function is ported

## Project structure

```
data/                    the dataset — the only thing you normally edit
  organisations/*.yaml
  sources/*.yaml
  activities/*.yaml
  funding/*.yaml
  affiliations/*.yaml
  right_of_reply/*.yaml
  events/*.yaml
  corrections/*.yaml
  submissions/*.yaml     moderation queue records (never rendered publicly)

drafts/                  output of ingestion scripts — NOT published data.
                          Review a draft, then hand-create the real file in /data.

src/
  schemas.ts              single source of truth for the data model (Zod)
  content.config.ts        wires src/schemas.ts into Astro content collections
  pages/                   routes
  components/, layouts/, lib/

scripts/
  validate.ts              validates /data against schemas.ts + editorial rules
  companies-house.ts        ingestion: company profile + filing history only
  charity-commission.ts     ingestion: register entry, income/expenditure
  grants.ts                 ingestion: 360Giving GrantNav
  lobbying-register.ts      ingestion: Registrar of Consultant Lobbyists CSV
  parliament.ts              ingestion: committee written evidence, APPG register
  archive.ts                 archives a URL to the Wayback Machine, returns the snapshot URL

netlify/functions/submit.ts  receives /submit form POSTs, files a GitHub issue
                              into the moderation queue. No public write path to /data.
```

## Getting started

```sh
npm install
npm run dev          # http://localhost:4321
```

Search only works after a full build (`npm run build`), because Pagefind
indexes the built HTML in `dist/`. It will not return results in `npm run dev`.

## Adding an organisation

1. Confirm the organisation's legal identity from a primary source —
   Companies House, the Charity Commission register, or equivalent.
   **Do not invent a record.** If you can't verify a field from a real
   source, leave it empty.
2. Create `data/organisations/<slug>.yaml`. See the three seed files
   (`universities-uk.yaml`, `russell-group.yaml`, `guildhe.yaml`) for the
   shape. `summary` must be neutral and factual, ≤300 characters, and must
   not contain named individuals.
3. Every claim about that organisation (an activity, a funding record, an
   affiliation) needs its own source (see below) and its own record in
   `data/activities/`, `data/funding/`, or `data/affiliations/`.
4. Run `npm run validate` before committing.

## Adding a source

1. Find the original document (a filing, a register entry, a consultation
   response, a grant record, etc.) and note its exact URL, publisher, title
   and date.
2. Archive it: `tsx scripts/archive.ts "<url>"`. This checks for an existing
   Wayback Machine snapshot first, and requests a new one if none exists.
   Copy the printed `archive_url`.
3. Create `data/sources/<id>.yaml` with both `original_url` and
   `archive_url` filled in — the build fails if either is missing.
4. Reference the source's `id` from the `source_ids` array of the
   activity/funding/affiliation record it supports. A record with zero
   sources, or a source_id that doesn't resolve, fails validation.

## Running validation

```sh
npm run validate
```

Checks every YAML file in `/data` against the Zod schemas and enforces the
project's editorial rules:

- every activity/funding/affiliation record cites ≥1 source, and every
  source has a non-empty `archive_url`
- no orphaned references (`source_ids`, org slugs, counterparty slugs all
  resolve)
- no file may contain a person/individual/officer/trustee key, or an
  allegation/severity/rating/score key — this fails the build
- free-text `description`/`summary` fields are scanned for a title-case
  two-word pattern (a possible personal name) and **flagged as a warning**
  for human review — it does not fail the build, since organisation names
  are themselves often title-cased (e.g. "Russell Group")
- warns (does not fail) on any activity not reviewed in the last 12 months

`npm run build` runs `npm run validate` first — a broken or unsourced
dataset fails the build, not just the standalone check. CI
(`.github/workflows/ci.yml`) runs `validate`, `typecheck`, and `build` on
every push and pull request.

## Ingestion scripts

Everything in `scripts/*.ts` (other than `validate.ts` and `archive.ts`) is
a manually-run helper that fetches from a public register/API and writes a
**draft** YAML file to `/drafts/<collection>/`. These scripts never write to
`/data` and are never run automatically. A human reviews each draft against
its source, fills in the slug/summary/source_ids by hand, archives the
source, and only then creates the real file in `/data`.

`companies-house.ts` calls **only** the company profile and filing-history
endpoints — never `/officers`, `/persons-with-significant-control`, or
`/appointments`. `charity-commission.ts` similarly never fetches trustee
data. This is a hard rule, not a style choice: this register has no field
for a person anywhere in its schema, and CI rejects any data file that adds
one.

## Submissions

`/submit` posts to a Netlify Function (`netlify/functions/submit.ts`), which
validates the payload, runs a best-effort check for personal names, and (if
configured) files a GitHub issue in a moderation-queue repo. Nothing
submitted through the form is published automatically or written to `/data`.
Set `SUBMISSIONS_GITHUB_REPO` and `SUBMISSIONS_GITHUB_TOKEN` in your deploy
environment before going live; without them the function returns a 503
rather than silently dropping submissions.

## Seed data

The three seed organisations (Universities UK, the Russell Group, GuildHE)
were hand-entered from their real Companies House filings, with every
activity record backed by an archived copy of a real published document
(a government consultation response, a public statement responding to a
parliamentary committee report, and an OfS consultation response
respectively). No data in `/data` was invented.
