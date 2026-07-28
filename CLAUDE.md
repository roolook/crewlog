# CrewLog — working notes for an agent

Read `README.md` for the architecture. This file is the short list of things that
will bite you.

## What this product is

A person receives a customer's spreadsheet plus a description of what they want,
and hands back a phone app in 48 hours. Not an app builder — the customer never
sees a builder, and the marketing must never imply otherwise. The honest promise
is *ask for anything, get a straight yes or no within 48 hours.*

## Invariants — don't break these

**Tenant isolation lives in Postgres, not in application code.** Every
tenant-scoped table has RLS policies gated on `is_member_of()` / `is_owner_of()`
/ `is_operator()`. The landing page promises "every company's data is fully
isolated", so a bug in a query must not be able to break it. After touching any
policy, re-run the isolation check in the README and confirm the anon key still
sees zero rows on every table.

**`supabaseAdmin()` bypasses RLS.** Only use it in server actions and route
handlers that have already called `requireOperator()`, or where the authorisation
is a token you just verified (the preview flow). Never import it into a client
component.

**The intake tables are insert-only for anonymous users.** Anyone can add to the
queue; only an operator can read it back. Keep that shape for anything new on
the intake path.

**A custom app must use the shared data spine.** Components in `app/custom/` get
the same `TenantBundle` and the same server actions as the generic shell. That's
what gives them isolation, CSV export, auth and invites for free. A custom app
that talks to the database another way is a bug, not a shortcut.

**Entry deletes are soft.** `entries.deleted_at` plus an owner-only policy backs
the "recoverable by the owner for 30 days" promise. Crews delete things by
accident on small screens.

**Keep the SheetJS pin.** `xlsx` comes from `cdn.sheetjs.com`, not npm. The npm
package is abandoned and carries prototype-pollution and ReDoS advisories, and it
parses untrusted customer uploads. `npm audit` will keep reporting `next`,
`postcss` and `sharp` — those are build-time transitives of Next itself with no
upgrade path (npm's suggested "fix" is Next 9.3.3). Leave them.

**Uploads go browser → Storage via signed URLs.** Never route a file through a
server action: Vercel caps the request body around 4.5 MB and phone photos
exceed that routinely.

## Design system

`lib/theme.ts` defines a ten-step type scale (`t`) and a three-tier section
rhythm (`band`). **No half-step font sizes** — 13.5, 16.5 and friends are what
make a page look assembled one value at a time. There are currently zero in the
codebase; keep it that way.

Use `components/Icon.tsx` for check and arrow marks. Don't use `✓` or `→` glyphs
as icons — they render at a different weight and baseline on every platform and
read as placeholder next to Archivo.

Component styling is inline, consuming `c`/`f`/`shadow` from the theme. This is
deliberate: the design depends on exact values (the paper cream, single-pixel
rules, offset hard shadows) and a utility framework would approximate them.

## Commands

```bash
npm run dev          # dev server
npm run build:check  # build into .next-verify — SAFE while dev is running
npm run build        # production build — will break a running dev server
npm run typecheck
```

**Use `build:check`, not `build`, while a dev server is up.** `next build` writes
over the chunks the dev server is serving and it dies with
`Cannot find module './###.js'` — an error whose cause is nowhere near where it
surfaces.

## Gotchas found the hard way

- **Supabase magic links for a first-time user carry `type=signup`**, not
  `magiclink`. `/auth/callback` validates against the full set of email OTP
  types; narrowing it breaks every new customer's first login.
- **A pending seat must be claimed on every login**, not just at signup. The
  `handle_new_user` trigger only fires for new auth users, so anyone who already
  had an account kept a `pending` row forever and landed on "no log yet". See
  `lib/membership.ts`.
- **Resend's `onboarding@resend.dev` can only deliver to the Resend account
  address.** Everything else 403s. `EMAIL_TEST_INBOX` redirects all mail there
  with the real recipient in the subject, so the funnel is walkable before a
  domain exists.
- **Don't put a Supabase-importing component in the same module as a cheap one.**
  `RatingField` lived beside the photo/signature uploaders and its static import
  pulled `supabase-js` into the app shell's base bundle for every tenant — 70 kB
  on first load. It's in its own file now.
- **Index expressions must be immutable.** `data::text` inside a `CREATE INDEX`
  fails and takes the whole migration with it.
- **An RLS policy cannot subquery its own table.** Postgres raises "infinite
  recursion detected in policy". Use a `SECURITY DEFINER` helper.
- **Programmatic `<select>` changes may not reach React.** Setting `.value` and
  dispatching `change` in raw JS can leave React state stale — a testing
  artifact, not a product bug. Drive selects through the harness's form-input
  tool instead.

## Testing against the real database

There is a live Supabase project wired up in `.env.local`. Migrations are applied
by pasting `supabase/schema.sql` (or the individual migration) into the Supabase
SQL editor — the CLI isn't linked, and `db push` needs a database password.

To sign in as anyone without sending email, mint a link with the admin API:

```bash
curl -s -X POST "$NEXT_PUBLIC_SUPABASE_URL/auth/v1/admin/generate_link" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"type":"magiclink","email":"someone@example.com"}'
```

Then visit `/auth/callback?token_hash=<hashed_token>&type=<verification_type>&next=/app`.

Note `.env.local` contains real keys. Don't print them, and don't commit them —
`.gitignore` already covers it, and `.env.example` is the only env file tracked.

## Test data currently in the database

`northgate-plumbing` and `harbourtree-arborists` are test tenants created while
verifying the funnel, along with the auth users `priya@northgateplumbing.com` and
`dev@harbourtree.example`. Safe to delete. The seeded demo tenants
(`sample-contracting`, `marek-electric`, `pruitt-landscape`,
`kettle-creek-plumbing`, `boucher-rentals`) ship with the migrations —
`sample-contracting` is what `/demo` and the landing page render, so keep it.
