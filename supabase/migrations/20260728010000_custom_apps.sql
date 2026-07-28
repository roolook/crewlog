-- ═══════════════════════════════════════════════════════════════════════════
-- CrewLog — from "spreadsheet → log" to "spreadsheet → whatever app you need"
--
-- Three things change:
--
--   1. A tenant can be `generated` (rendered from tenant_fields, as today) or
--      `custom` (a hand-built app keyed by custom_app_key). The data spine is
--      shared either way — a custom app still reads and writes `entries`, still
--      goes through RLS, and so inherits isolation, export and invites free.
--
--   2. Fields get richer types. `location`, `photo`, `signature` and friends are
--      opt-in: the operator assigns them when a customer asks. Nothing about the
--      default generated app changes.
--
--   3. Intake stops being one spreadsheet. Many attachments of any type, plus
--      one row per capability the customer asked for, so nothing they said gets
--      lost between the form and the build screen.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── richer field types ──────────────────────────────────────────────────────
-- Postgres can only add enum values one statement at a time, and not inside a
-- transaction block that then uses them — hence the plain sequence here.

alter type public.field_type add value if not exists 'long_text';
alter type public.field_type add value if not exists 'currency';
alter type public.field_type add value if not exists 'rating';
alter type public.field_type add value if not exists 'location';
alter type public.field_type add value if not exists 'photo';
alter type public.field_type add value if not exists 'signature';
alter type public.field_type add value if not exists 'barcode';

comment on type public.field_type is
  'text/number/date/dropdown/boolean are inferred from the sheet. The rest are '
  'opt-in capabilities an operator assigns when the customer asks for them; '
  'their values are stored as JSON objects inside entries.data.';

-- ── tenants: generated vs custom, and which tier they bought ────────────────

create type public.app_kind as enum ('generated', 'custom');
create type public.plan_tier as enum ('standard', 'custom');

alter table public.tenants
  add column app_kind public.app_kind not null default 'generated',
  -- Names a component in the app/custom registry. Null for generated tenants.
  -- Deliberately not a path: nothing here is used to build a filesystem lookup.
  add column custom_app_key text
    check (custom_app_key is null or custom_app_key ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  add column plan_tier public.plan_tier not null default 'standard';

-- A custom tenant with no key would render nothing, so require the pair.
alter table public.tenants
  add constraint tenants_custom_needs_key
  check (app_kind = 'generated' or custom_app_key is not null);

create index tenants_custom_idx
  on public.tenants (custom_app_key) where app_kind = 'custom';

comment on column public.tenants.app_kind is
  'generated = rendered from tenant_fields. custom = hand-built component, '
  'still on the shared entries/RLS data spine.';

-- ── intake attachments ──────────────────────────────────────────────────────
-- Replaces the single file per submission. "Send all of it" now means what it
-- says: a zip of sheets, four photos of a whiteboard, a PDF of the paper form.

create table public.intake_attachments (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null
                  references public.intake_submissions (id) on delete cascade,
  -- Path inside the `intake` bucket.
  path          text not null,
  file_name     text not null,
  file_size     integer,
  mime_type     text,
  -- The one the parser should read. Set by the operator, or guessed at upload
  -- from the extension. Photos and PDFs are context, not data.
  is_primary    boolean not null default false,
  position      integer not null default 0,
  created_at    timestamptz not null default now()
);

create index intake_attachments_submission_idx
  on public.intake_attachments (submission_id, position);

-- At most one primary per submission, so "which file is the sheet" is never
-- ambiguous.
create unique index intake_attachments_one_primary
  on public.intake_attachments (submission_id) where is_primary;

-- Carry the existing single-file submissions across rather than orphaning them.
insert into public.intake_attachments
  (submission_id, path, file_name, file_size, is_primary, position)
select id, file_path, coalesce(file_name, 'attachment'), file_size, true, 0
  from public.intake_submissions
 where file_path is not null;

-- The old columns stay as a read-only record of the first upload; new writes go
-- to intake_attachments. Dropping them would break nothing in the app but would
-- lose the provenance of rows imported before this migration.
comment on column public.intake_submissions.file_path is
  'Superseded by intake_attachments. Retained for rows created before that '
  'table existed; new submissions leave this null.';

-- ── what the customer actually asked for ────────────────────────────────────

create type public.request_status as enum
  ('open', 'done', 'wont_do', 'needs_quote');

create table public.intake_requests (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null
                  references public.intake_submissions (id) on delete cascade,
  tenant_id     uuid references public.tenants (id) on delete set null,
  -- Stable identifier when it came from the pick-list ('location', 'photo'…),
  -- null when the customer typed it themselves.
  capability    text,
  -- Always populated: the pick-list label, or their own words.
  body          text not null,
  status        public.request_status not null default 'open',
  -- Operator's private note. Replies to the customer are sent by hand.
  operator_note text,
  created_at    timestamptz not null default now(),
  resolved_at   timestamptz
);

create index intake_requests_submission_idx
  on public.intake_requests (submission_id, created_at);
create index intake_requests_open_idx
  on public.intake_requests (status) where status = 'open';

comment on table public.intake_requests is
  'One row per capability the customer asked for. Recorded so nothing is lost '
  'between the intake form and the build screen; answered by hand.';

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Same shape as intake_submissions: anyone may add to the queue, only an
-- operator may read it back.

alter table public.intake_attachments enable row level security;
alter table public.intake_requests    enable row level security;

create policy "attachments: anyone submits"
  on public.intake_attachments for insert
  to anon, authenticated
  with check (true);

create policy "attachments: operator reads"
  on public.intake_attachments for select
  using (public.is_operator());

create policy "attachments: operator writes"
  on public.intake_attachments for update
  using (public.is_operator())
  with check (public.is_operator());

create policy "requests: anyone submits"
  on public.intake_requests for insert
  to anon, authenticated
  with check (true);

create policy "requests: operator reads"
  on public.intake_requests for select
  using (public.is_operator());

create policy "requests: operator writes"
  on public.intake_requests for update
  using (public.is_operator())
  with check (public.is_operator());

-- ── storage ─────────────────────────────────────────────────────────────────
-- "Send all of it" can't be enforced against an allowlist of spreadsheet mime
-- types. Null means any type; the 50 MB per-file cap and the signed-upload flow
-- remain the real limits, and nothing in the bucket is ever served publicly or
-- executed.

update storage.buckets
   set allowed_mime_types = null
 where id = 'intake';
