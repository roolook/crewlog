# CrewLog

Your spreadsheet, rebuilt as an app your team actually uses.

A working implementation of the CrewLog intake funnel: marketing site → spreadsheet
intake → operator build console → customer preview → activation → the multi-tenant
phone app itself. Next.js (App Router) on Vercel, Supabase for Postgres, auth and
file storage.

## What's here

| Route | What it is |
| --- | --- |
| `/` | Landing page. Hero spreadsheet→phone animation, cost-of-doing-nothing calculator, work-order "how it works", pricing, FAQ. |
| `/demo` | A fully interactive app loaded with sample data. No auth, no database — state lives in the browser. Embedded in the landing page's phone. |
| `/start` | The intake funnel. Uploads the spreadsheet straight to Supabase Storage, files a work order, sends the "got your spreadsheet" email. |
| `/login` | Magic-link login. No passwords anywhere in the product. |
| `/app` | Redirects to your log; shows a picker if you're in more than one. |
| `/app/[slug]` | **The product.** Log list, entry form, detail, search, dashboard, team, settings — all generated from the tenant's column schema. |
| `/preview/[slug]?t=…` | What the "your app is ready" email links to. Their real rows in a phone frame, plus the activate CTA. Authorised by the preview token, not a login. |
| `/ops` | Operator console: intake inbox (oldest first, 48h clock), schema editor, tenants, change requests, email log. |
| `/api/export/[slug]` | Full CSV of a tenant's log. The "nothing is held hostage" promise, on demand. |
| `/api/stripe` | Checkout webhook. Inert until `STRIPE_WEBHOOK_SECRET` is set. |

## How the multi-tenancy works

One app shell serves every customer. A tenant's `tenant_fields` rows describe the
columns from their spreadsheet — label, type, whether it's required, whether it
shows on the card, its dropdown options, which column is the card title and which
is the status. Entry values live in `entries.data` (jsonb), with `title` and
`status_value` denormalised so they can be indexed and searched.

That's why the operator's job is "correct the inferred schema and press Generate"
rather than "write a new app".

Isolation is enforced by row-level security, not application code: `is_member_of()`
and `is_owner_of()` gate every tenant-scoped table. A query made on one team's
behalf cannot return another team's rows even if the app has a bug. See
`supabase/migrations/20260728000100_rls.sql`.

## Setup

### 1. Create a Supabase project

Then copy `.env.example` to `.env.local` and fill in the values from
**Project Settings → API**:

```bash
cp .env.example .env.local
```

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — public, browser-safe
- `SUPABASE_SERVICE_ROLE_KEY` — server only, bypasses RLS, used by intake and `/ops`
- `OPERATOR_EMAILS` — comma-separated; these emails can reach `/ops`. Everyone else gets a 404.

### 2. Push the schema

```bash
npx supabase login
npx supabase link --project-ref YOUR-PROJECT-REF
npx supabase db push
```

This creates the tables, the RLS policies, the two storage buckets (`intake`,
`entry-photos`), and a demo tenant.

### 3. Point Supabase Auth at the app

In **Authentication → URL Configuration**:

- Site URL: your deployment origin (e.g. `https://crewlog.vercel.app`)
- Redirect URLs: add `https://your-origin/auth/callback` and `http://localhost:3000/auth/callback`

Optionally paste the magic-link template from `lib/email/templates.ts`
(`magicLinkEmail`) into **Authentication → Email Templates** so the login email
matches the rest of the system.

### 4. Run it

```bash
npm install && npm run dev
```

## Email

Every transactional email is rendered and written to the `email_log` table
regardless of configuration, and visible at `/ops/emails`. That page is the
audit trail, and with `EMAIL_PROVIDER=log` it's also the entire outbox — enough
to walk the whole funnel with no mail account at all.

The five templates, matching the design doc: `received`, `preview_ready`,
`magic_link`, `crew_invite`, `activation_receipt`. Preview them without a
database at `/dev/emails` (development only).

### Sending through Resend's sandbox — no domain needed

Set `EMAIL_PROVIDER=resend`, add `RESEND_API_KEY`, and leave the sender as
Resend's shared `onboarding@resend.dev`. No DNS setup required.

**The catch:** that shared sender can only deliver to the email address on your
Resend account. Every other recipient is rejected with a 403 —
["You can only send testing emails to your own email address"](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain).
It's a test harness, not a mail service.

So set `EMAIL_TEST_INBOX` to your Resend account address. Every message is then
redirected there, with:

- the real recipient in the subject line — `[→ gary@pruittlandscape.com] Your app is ready`
- a banner at the top of the body naming who it was for
- `email_log.to_email` still recording the *intended* recipient, so the audit
  trail stays truthful

You receive the customer-facing mail exactly as they would, which is what makes
the funnel testable before a domain exists.

### Going live

Verify a domain in Resend, then:

```bash
EMAIL_FROM_BUILD="CrewLog <build@yourdomain.com>"
EMAIL_FROM_LOG="CrewLog <log@yourdomain.com>"
EMAIL_TEST_INBOX=          # empty — stop redirecting
```

`EMAIL_REPLY_TO` keeps a human address on every message regardless of which
domain sent it, so "reply to any email from us" holds even in the sandbox.

Failures never throw — a dead mail provider must not take down an intake
submission. They're written to `email_log.error` and surfaced at the top of
`/ops/emails` with the actionable message spelled out, because the sandbox 403
otherwise reads like a bad API key.

## Payments

Also stubbed by design. With `STRIPE_PAYMENT_LINK` empty, the Activate button on
the preview page marks the tenant active and emails the receipt directly, so the
funnel works end to end before any payment account exists.

To take real money:

1. Create a Stripe Payment Link for the setup fee + monthly subscription
2. Set `STRIPE_PAYMENT_LINK`
3. Add `https://your-origin/api/stripe` as a webhook endpoint for
   `checkout.session.completed`, and set `STRIPE_WEBHOOK_SECRET`

Signatures are verified with Web Crypto (HMAC-SHA256, constant-time compare,
300s replay window) — no SDK dependency on the untrusted-input path. Without a
configured secret the endpoint returns 501 rather than trusting anything.

## The operator workflow

1. A submission lands in `/ops`, oldest first, with hours-elapsed against the
   48-hour promise (past 36h it turns orange).
2. **BUILD →** downloads their file, finds the header row, guesses each column's
   type, harvests dropdown options from the distinct values, and picks the title
   and status columns. See `lib/parse.ts`.
3. Correct anything wrong, name the company, press **Generate app**. That creates
   the tenant, writes the schema, imports every row, seats the owner, and emails
   the preview link.
4. The customer opens the preview, activates, and invites their crew.

Sheets that can't be parsed — a photo of a whiteboard, a PDF — drop you into the
same editor with a blank schema to type in by hand.

## Notable choices

**The preview app doesn't persist.** It loads the customer's real rows but runs on
local state, so "break it if you can" is safe and there's no unauthenticated write
path into a real tenant's log. Writes begin once they activate and sign in.

**Deletes are soft.** `entries.deleted_at` plus an owner-only RLS policy backs the
"recoverable by the owner for 30 days" promise. Crews delete things by accident on
small screens.

**Uploads bypass the server.** `/start` requests a signed upload URL and sends the
file straight to Storage, so a 20 MB whiteboard photo isn't capped by Vercel's
~4.5 MB request body limit.

**Mutations are optimistic.** The shell patches local state immediately and
reconciles with the server row, which is what makes the `syncing… / saved ✓`
indicator honest rather than decorative.

## Known dependency advisories

`npm audit` reports three high-severity advisories in `next`, `postcss` and
`sharp`. All three are build-time transitive dependencies of Next itself with no
upgrade path — npm's suggested "fix" is Next 9.3.3. The one advisory that mattered
was in `xlsx`, which sits on the untrusted-input path (it parses customer files);
that's resolved by pinning SheetJS's maintained build from their own CDN rather
than the abandoned npm package.

## Scripts

```bash
npm run dev        # dev server
npm run build      # production build
npm run typecheck  # tsc --noEmit
npm run db:push    # push migrations to the linked Supabase project
npm run db:reset   # rebuild the local database from migrations
```
