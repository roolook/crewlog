# CrewLog

Send us the spreadsheet you run on and tell us what it should do. A person builds
it into a phone app — your data already inside — in 48 hours.

Next.js 15 (App Router) on Vercel, Supabase for Postgres, auth and file storage.
`CLAUDE.md` has the short list of invariants and gotchas; this file is the
architecture.

## Status

Working end to end against a live Supabase project: intake with multiple files
and capability requests, spreadsheet parsing, schema inference, tenant
generation, preview, activation, owner login, crew invites, rich field types
including a map pin, and hand-built custom apps. All five transactional emails
deliver through Resend.

Not deployed. Payments are an env-driven stub.

## Routes

| Route | What it is |
| --- | --- |
| `/` | Landing page. Hero animation, cost calculator, capability list, work-order steps, two-tier pricing, FAQ. |
| `/demo` | A fully interactive app on sample data. No auth, no database — state lives in the browser. Embedded in the landing phone. |
| `/start` | Intake. Many files of any type, a capability pick-list, and two specific prompts. |
| `/login` | Magic link. No passwords anywhere in the product. |
| `/app` | Redirects to your log; shows a picker if you're in more than one. |
| `/app/[slug]` | **The product.** Either the generated shell or a hand-built custom app. |
| `/preview/[slug]?t=…` | What the "your app is ready" email opens. Authorised by the preview token, not a login. |
| `/ops` | Operator console: inbox, build screen, tenants, change requests, email outbox. |
| `/dev/emails` | All five email templates with no database. 404s outside development. |
| `/api/export/[slug]` | Full CSV of a tenant's log. |
| `/api/stripe` | Checkout webhook. Returns 501 until configured. |

## The core mechanic

**One app shell serves every tenant.** A tenant's `tenant_fields` rows describe
the columns from their spreadsheet — label, type, required, whether it shows on
the card, dropdown options, which column titles the card and which is the status.
Entry values live in `entries.data` as jsonb, with `title` and `status_value`
denormalised so they can be indexed, sorted and searched.

`lib/parse.ts` infers all of that from the uploaded file: it finds the real header
row (past title rows and blank rows), guesses each column's type, harvests
dropdown options from the distinct values, and picks the title and status columns.
The operator corrects the guess in `/ops/build/[id]` and presses Generate, which
creates the tenant, writes the schema, imports every row, seats the owner and
emails the preview link.

That is why the operator's job is "correct the inferred schema and press
Generate" rather than "write a new app."

## Field types

Five are inferred from the sheet: `text`, `number`, `date`, `dropdown`,
`boolean`.

Seven are **opt-in capabilities** an operator assigns when a customer asks:
`long_text`, `currency`, `rating`, `location`, `photo`, `signature`, `barcode`.
The parser never infers these. `lib/capabilities.ts` is the single catalogue
shared by the intake pick-list, the landing page and the build screen — so the
site can't promise something the form doesn't offer.

`location`, `photo` and `signature` store **objects** in `entries.data`, not
scalars, so anything reading a value goes through `lib/fields.ts`
(`displayValue`, `hasValue`, `coerceValue`). `coerceValue` runs server-side on
every write: a malformed pin, a dropdown value that isn't an option, or a storage
path pointing outside our namespace all become `null` rather than being stored.

The capability widgets are `next/dynamic` with `ssr: false`, so a tenant with no
location column never downloads MapLibre. First-load JS for `/app/[slug]` is
~114 kB; the map is a separate ~553 kB chunk fetched only when a picker opens.

### The map

`location` uses MapLibre GL JS with MapTiler tiles. **The key is optional.**
Without `NEXT_PUBLIC_MAPTILER_KEY` the field still captures the phone's GPS,
still takes a typed description and typed coordinates, and still hands the pin to
the phone's own map app — it just can't draw tiles. Capturing the pin is the part
that matters.

MapLibre and the OSM data are open; what's metered is tile *hosting*. OSM's public
tile servers explicitly prohibit commercial use, so don't point at them.

## Generated vs custom apps

`tenants.app_kind` is `generated` or `custom`.

A `custom` tenant names a component via `custom_app_key`, looked up in
`app/custom/registry.tsx`. `/app/[slug]` renders it instead of the generic shell.
An unknown key falls back to the generic shell — a working generic app beats
showing nothing while the code is still being written.

Custom apps **ship with a deploy**. Nothing loads operator-authored code at
runtime, so there's no sandbox to get wrong and no way for one bad build to take
down another customer. That also fits the brand promise: a person builds it.

The critical constraint: a custom app receives the same `TenantBundle` and the
same server actions as the generic shell, so it reads and writes `entries`
through RLS and inherits isolation, CSV export, magic-link auth and crew invites
without implementing any of them. **Customise presentation and interaction; never
fork the data layer.**

`app/custom/route-day/` is a worked example — a driver's day, ordered by stop
rather than reverse-chronologically, with one action per row and "stops left" as
the headline number instead of an entry count.

## Isolation

Enforced by row-level security, not application code: `is_member_of()`,
`is_owner_of()` and `is_operator()` gate every tenant-scoped table. The landing
page promises "every company's data is fully isolated", so a query bug must not
be able to break it.

Verified: the anon key returns zero rows on all ten tables, an anon insert into a
real tenant is rejected with `42501`, an anon update matches zero rows and changes
nothing, cross-tenant reads 404 for a logged-in user, and an uploaded file that
the service role can read is unreachable with the anon key.

To re-check after touching a policy:

```bash
set -a; . ./.env.local; set +a
for t in tenants entries tenant_members tenant_fields intake_submissions \
         intake_attachments intake_requests change_requests email_log profiles; do
  n=$(curl -s -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
        -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
        "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/$t?select=*&limit=5" \
      | python3 -c 'import sys,json;print(len(json.load(sys.stdin)))')
  printf '%-20s %s\n' "$t" "$([ "$n" = 0 ] && echo BLOCKED || echo LEAK)"
done
```

## Data model

- `profiles` — one row per auth user; `is_operator` gates `/ops`.
- `tenants` — one customer. `app_kind`, `custom_app_key`, `plan_tier`,
  `preview_token`, hero-metric config.
- `tenant_members` — seats. A seat can exist with `user_id` null and
  `status: pending`, claimed by email on first login.
- `tenant_fields` — the generated schema. One title field and one status field
  per tenant, enforced by partial unique indexes.
- `entries` — `data` jsonb plus denormalised `title` / `status_value` /
  `occurred_on`. Per-tenant `entry_no` allocated by trigger. Soft deleted.
- `intake_submissions` — the queue.
- `intake_attachments` — many files per submission; `is_primary` marks the one
  the parser reads.
- `intake_requests` — one row per capability asked for, with a status the
  operator ticks by hand.
- `change_requests` — "reply to any email from us", fed into `/ops/changes`.
- `email_log` — every transactional email rendered and recorded, delivered or not.

Storage buckets: `intake` (private, 50 MB/file, any type) and `entry-photos`
(private, 20 MB/file, images; namespaced `<tenant_id>/…` which is exactly what the
storage policy checks).

## Setup

### 1. Supabase project

```bash
cp .env.example .env.local
```

Fill in from **Project Settings → API**: `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Set
`OPERATOR_EMAILS` to the comma-separated emails allowed into `/ops`; everyone
else gets a 404.

### 2. Identity provider

CrewLog currently uses Clerk for Google and email sign-in. Set
`AUTH_PROVIDER=clerk`, then add `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and
`CLERK_SECRET_KEY`. Enable Google and the desired email strategy in the Clerk
dashboard.

The provider boundary lives in `lib/identity/`. Clerk produces a small
provider-neutral identity, and `/auth/complete` bridges it to the existing
Supabase session used by row-level security. To replace Clerk later, add a new
adapter that returns `AppIdentity`, change `IdentityRootProvider`, and switch
`AUTH_PROVIDER`. Tenant queries and product pages do not need to change.

Set `AUTH_PROVIDER=supabase` to keep using the built-in email-link login during
a migration.

### 3. Schema

Paste `supabase/schema.sql` into the Supabase SQL editor and run it. That's all
migrations concatenated in order; it is not idempotent, so run it once on a fresh
project.

With the CLI linked you can instead use `npm run db:push` (needs your database
password).

### 4. Supabase email-link fallback

**Authentication → URL Configuration**: set Site URL to your origin, and add
`https://your-origin/auth/callback` plus `http://localhost:3000/auth/callback` to
Redirect URLs. Without this, real magic links won't come back to the app.

Optionally paste `magicLinkEmail` from `lib/email/templates.ts` into
**Authentication → Email Templates** so the login mail matches the rest.

### 5. Run

```bash
npm install && npm run dev
```

## Email

Every transactional email is rendered and written to `email_log` regardless of
configuration, and shown at `/ops/emails`. With `EMAIL_PROVIDER=log` that page
*is* the outbox — enough to walk the whole funnel with no mail account.

To send for real: `EMAIL_PROVIDER=resend` plus `RESEND_API_KEY`, with the sender
left as Resend's shared `onboarding@resend.dev` (no DNS setup).

**That shared sender only delivers to the address on your Resend account** —
everything else 403s. So set `EMAIL_TEST_INBOX` to that address and every message
is redirected there with the real recipient in the subject line
(`[→ gary@example.com] Your app is ready`) and a banner in the body.
`email_log.to_email` still records the intended recipient, so the audit trail
stays truthful.

Going live: verify a domain in Resend, point `EMAIL_FROM_BUILD` /
`EMAIL_FROM_LOG` at it, and empty `EMAIL_TEST_INBOX`. `EMAIL_REPLY_TO` keeps a
human address on every message either way.

## Payments

Two tiers: `$99` standard, `$299` custom, both `+$10/month`
(`NEXT_PUBLIC_SETUP_FEE`, `NEXT_PUBLIC_CUSTOM_SETUP_FEE`,
`NEXT_PUBLIC_MONTHLY_FEE`).

With `STRIPE_PAYMENT_LINK` empty, Activate marks the tenant active and emails the
receipt directly, so the funnel works before any payment account exists. To take
money: create a Payment Link, set `STRIPE_PAYMENT_LINK`, add
`https://your-origin/api/stripe` as a webhook for `checkout.session.completed`,
and set `STRIPE_WEBHOOK_SECRET`.

Signatures are verified with Web Crypto (HMAC-SHA256, constant-time compare, 300s
replay window) rather than the Stripe SDK, so nothing extra sits on the
untrusted-input path. Unconfigured, the endpoint returns 501 rather than trusting
a request.

## The operator workflow

1. A submission lands in `/ops`, oldest first, with hours elapsed against the
   48-hour promise (past 36h it turns orange).
2. **BUILD →** shows every attachment (with download links, and which one is
   being parsed), every capability the customer asked for, and the inferred
   schema.
3. Correct the schema, assign any capability columns, set the tier, name the
   company, press **Generate app**. That creates the tenant, imports the rows,
   seats the owner and emails the preview link.
4. Tick each request done / won't do / needs a quote, and **reply to the customer
   by hand** — nothing is emailed automatically.
5. To ship something bespoke: write a component in `app/custom/<key>/`, register
   it, and set the tenant's `custom_app_key`.

Unparseable input — a photo of a whiteboard, a PDF — drops you into the same
editor with a blank schema to type in by hand.

## File map

```
app/
  page.tsx                     landing
  start/                       intake form + actions
  app/[slug]/                  the product; TenantApp picks generated vs custom
  custom/registry.tsx          custom app lookup
  custom/route-day/            worked example custom app
  preview/[slug]/              emailed preview + activation
  ops/                         operator console
  auth/callback/               where magic links land
components/
  app/AppShell.tsx             the generated app (log/form/detail/search/dash/team/settings)
  app/fields/                  capability widgets, lazily loaded
  landing/                     hero animation, calculator, FAQ, capability list
  Icon.tsx                     the only two icons
lib/
  theme.ts                     colours, type scale (t), section rhythm (band)
  types.ts                     the domain model
  schema.ts                    tenant_fields → app layout
  fields.ts                    reading/writing rich field values
  capabilities.ts              the capability catalogue
  parse.ts                     spreadsheet → proposed schema
  auth.ts                      requireOperator, loadTenantBundle
  email/                       templates + pluggable sender
  supabase/                    server, browser and service-role clients
supabase/migrations/           source of truth for the schema
supabase/schema.sql            all migrations concatenated, for the SQL editor
```

## Known gaps

- **Not deployed.** No Vercel project yet.
- **No SMS.** Inviting by phone creates the seat and its token but sends nothing;
  wiring a provider is a call in `inviteMemberAction`.
- **Reminders, offline and print/PDF** are offered on the intake pick-list as
  things a customer can *ask for*, and recorded as requests, but not implemented.
  They need a person, which is the honest position — just don't read the
  pick-list as a feature list.
- **The 30-day recycle bin has no UI.** Soft deletes and the owner-only read
  policy exist; nothing surfaces them yet.
- **Sheet sync is one-way.** Import at build time; no ongoing sync despite the
  pricing card mentioning it. Either build it or drop the claim.
- **`t` is exported but unused.** Font sizes were applied by hand and are all
  on-scale; referencing `t.body` at call sites would make an off-scale value a
  type error instead of something a reviewer has to catch.
- **Storage usage isn't metered.** The 25 GB limit is stated, not enforced.

## Scripts

```bash
npm run dev          # dev server
npm run build:check  # build into .next-verify — safe while dev is running
npm run build        # production build
npm run typecheck
npm run db:push      # push migrations to a linked Supabase project
```
