-- ═══════════════════════════════════════════════════════════════════════
-- CrewLog — complete schema, all migrations in order.
--
-- Generated from supabase/migrations/. Paste into the Supabase SQL editor
-- and Run. Safe on a fresh project; not idempotent, so don't run it twice.
-- ═══════════════════════════════════════════════════════════════════════

-- ┌──────────────────────────────────────────────────────────────────────
-- │ 20260728000000_init.sql
-- └──────────────────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════════════════════════════════════
-- CrewLog — core schema
--
-- Shape of the product: an operator receives a spreadsheet (intake_submissions),
-- parses it into a column schema (tenant_fields), and generates a tenant whose
-- app renders entirely from that schema. Entry values live in `entries.data`
-- (jsonb) so one app shell serves every customer's differently-shaped sheet.
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ── profiles ────────────────────────────────────────────────────────────────
-- Mirrors auth.users so we can join names/roles without touching the auth schema.

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        citext not null,
  full_name    text,
  phone        text,
  is_operator  boolean not null default false,
  created_at   timestamptz not null default now()
);

comment on table public.profiles is
  'One row per auth user. is_operator gates the /ops console.';

-- ── tenants ─────────────────────────────────────────────────────────────────

create type public.tenant_status as enum ('preview', 'active', 'churned');

create table public.tenants (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null unique
                       check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name               text not null,
  log_label          text not null default 'LOG',
  status             public.tenant_status not null default 'preview',
  owner_id           uuid references public.profiles (id) on delete set null,
  owner_name         text,
  owner_email        citext,
  -- Which dashboard number gets the big treatment. hero_field_key/value name
  -- the field and the value that counts, e.g. ('status','Checked out').
  hero_label         text not null default 'ITEMS OPEN RIGHT NOW',
  hero_field_key     text,
  hero_field_value   text,
  source_file_name   text,
  source_row_count   integer not null default 0,
  storage_limit_mb   integer not null default 25600,
  notes              text,
  -- The unguessable key in the emailed preview link. Lets someone who has not
  -- signed up yet open their own build without exposing every slug to the world.
  preview_token      uuid not null default gen_random_uuid(),
  preview_expires_at timestamptz,
  activated_at       timestamptz,
  created_at         timestamptz not null default now()
);

create index tenants_status_idx on public.tenants (status);
create index tenants_owner_idx  on public.tenants (owner_id);

-- ── membership ──────────────────────────────────────────────────────────────

create type public.member_role   as enum ('owner', 'crew');
create type public.member_status as enum ('active', 'pending', 'removed');

create table public.tenant_members (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants (id) on delete cascade,
  user_id       uuid references public.profiles (id) on delete set null,
  -- A crew member invited by phone/email has no user_id until they follow the
  -- link, so display_name carries them through the pending state.
  display_name  text not null,
  email         citext,
  phone         text,
  role          public.member_role   not null default 'crew',
  status        public.member_status not null default 'active',
  invite_token  uuid unique default gen_random_uuid(),
  last_log_at   timestamptz,
  joined_at     timestamptz,
  created_at    timestamptz not null default now()
);

create unique index tenant_members_user_uniq
  on public.tenant_members (tenant_id, user_id)
  where user_id is not null;

create index tenant_members_tenant_idx on public.tenant_members (tenant_id);
create index tenant_members_user_idx   on public.tenant_members (user_id);

-- ── the generated schema ────────────────────────────────────────────────────

create type public.field_type as enum ('text', 'number', 'date', 'dropdown', 'boolean');

create table public.tenant_fields (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  key         text not null check (key ~ '^[a-z0-9_]+$'),
  label       text not null,
  type        public.field_type not null default 'text',
  required    boolean not null default false,
  on_card     boolean not null default true,
  -- Dropdown choices, harvested from the distinct values in the source sheet.
  options     text[] not null default '{}',
  -- Exactly one field per tenant is the headline; it titles every log card.
  is_title    boolean not null default false,
  -- Exactly one field may drive status colouring / stamps.
  is_status   boolean not null default false,
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  unique (tenant_id, key)
);

create index tenant_fields_tenant_idx on public.tenant_fields (tenant_id, position);

-- Only one title field and one status field per tenant.
create unique index tenant_fields_one_title
  on public.tenant_fields (tenant_id) where is_title;
create unique index tenant_fields_one_status
  on public.tenant_fields (tenant_id) where is_status;

-- ── entries ─────────────────────────────────────────────────────────────────

create table public.entries (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants (id) on delete cascade,
  -- Per-tenant sequential number, rendered as №0001 in the app.
  entry_no      integer not null,
  data          jsonb not null default '{}'::jsonb,
  -- Denormalised copies of the title/status fields so we can index, sort and
  -- full-text search without unpacking jsonb on every row.
  title         text not null default '',
  status_value  text,
  occurred_on   date,
  created_by    uuid references public.profiles (id) on delete set null,
  created_by_name text,
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (tenant_id, entry_no)
);

create index entries_tenant_created_idx
  on public.entries (tenant_id, created_at desc) where deleted_at is null;
create index entries_tenant_status_idx
  on public.entries (tenant_id, status_value) where deleted_at is null;
-- Index expressions must be immutable, and the jsonb→text cast is not, so this
-- covers the title only. Search in the app is client-side over the loaded page;
-- this is here for when it moves server-side.
create index entries_search_idx
  on public.entries using gin (to_tsvector('english', title));

comment on column public.entries.deleted_at is
  'Soft delete. The app promises owners 30 days of recovery.';

-- Allocate the next entry_no per tenant without a race.
create or replace function public.set_entry_no()
returns trigger
language plpgsql
as $$
begin
  if new.entry_no is null or new.entry_no = 0 then
    select coalesce(max(entry_no), 0) + 1
      into new.entry_no
      from public.entries
     where tenant_id = new.tenant_id;
  end if;
  return new;
end;
$$;

create trigger entries_set_no
  before insert on public.entries
  for each row execute function public.set_entry_no();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger entries_touch
  before update on public.entries
  for each row execute function public.touch_updated_at();

-- ── intake ──────────────────────────────────────────────────────────────────

create type public.intake_status as enum
  ('queued', 'building', 'preview_sent', 'activated', 'archived');

create table public.intake_submissions (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  email        citext not null,
  company_name text,
  work_order   text,
  intake_answers jsonb not null default '{}'::jsonb,
  build_draft  jsonb not null default '{}'::jsonb,
  notes        text,
  phone        text,
  -- Path inside the `intake` storage bucket. Null when the customer chose
  -- "I'll email it after".
  file_path    text,
  file_name    text,
  file_size    integer,
  by_email     boolean not null default false,
  status       public.intake_status not null default 'queued',
  tenant_id    uuid references public.tenants (id) on delete set null,
  preview_sent_at timestamptz,
  delivery_error text,
  created_at   timestamptz not null default now()
);

create index intake_status_idx on public.intake_submissions (status, created_at);
create unique index intake_work_order_idx
  on public.intake_submissions (work_order) where work_order is not null;

-- ── change requests ─────────────────────────────────────────────────────────

create table public.change_requests (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid references public.tenants (id) on delete cascade,
  requester     text not null,
  requester_email citext,
  body          text not null,
  done          boolean not null default false,
  created_at    timestamptz not null default now(),
  done_at       timestamptz
);

create index change_requests_open_idx
  on public.change_requests (done, created_at desc);

-- ── email log ───────────────────────────────────────────────────────────────
-- Every transactional email is rendered and recorded here, whether or not a
-- provider is configured. This is the audit trail and the ops preview source.

create table public.email_log (
  id          uuid primary key default gen_random_uuid(),
  template    text not null,
  to_email    citext not null,
  from_email  citext not null,
  subject     text not null,
  html        text not null,
  text_body   text,
  tenant_id   uuid references public.tenants (id) on delete set null,
  provider    text not null default 'log',
  provider_id text,
  error       text,
  created_at  timestamptz not null default now()
);

create index email_log_recent_idx on public.email_log (created_at desc);

-- ── helpers used by RLS ─────────────────────────────────────────────────────

-- SECURITY DEFINER so the policy on tenant_members can call it without
-- recursing into that same table's policies.
create or replace function public.is_member_of(target uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
      from public.tenant_members m
     where m.tenant_id = target
       and m.user_id = auth.uid()
       and m.status = 'active'
  );
$$;

create or replace function public.is_owner_of(target uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
      from public.tenant_members m
     where m.tenant_id = target
       and m.user_id = auth.uid()
       and m.role = 'owner'
       and m.status = 'active'
  );
$$;

create or replace function public.is_operator()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select p.is_operator from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

-- ── new-user bootstrap ──────────────────────────────────────────────────────
-- On signup: create the profile, then claim any membership row that was
-- pre-created for this email by an invite, so the invitee lands in the right
-- tenant on their very first magic-link login.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  operator_list text := current_setting('app.operator_emails', true);
begin
  insert into public.profiles (id, email, full_name, phone, is_operator)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'phone',
    -- Optional convenience: set `app.operator_emails` on the database to have
    -- operators flagged automatically at signup. The app's OPERATOR_EMAILS
    -- allowlist is the real gate on /ops, so this staying unset is fine.
    operator_list is not null
      and lower(new.email) = any (
        select btrim(e) from unnest(string_to_array(lower(operator_list), ',')) as e
      )
  )
  on conflict (id) do nothing;

  update public.tenant_members
     set user_id  = new.id,
         status   = 'active',
         joined_at = coalesce(joined_at, now())
   where user_id is null
     and email = new.email;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ┌──────────────────────────────────────────────────────────────────────
-- │ 20260728000100_rls.sql
-- └──────────────────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════════════════════════════════════
-- Row level security
--
-- The promise on the landing page is "Every company's data is fully isolated."
-- That is enforced here, not in application code: every tenant-scoped table is
-- readable only by active members of that tenant (or an operator).
--
-- The intake form is the one anonymous write in the system, and it is
-- insert-only — nobody can read the queue without being an operator.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.profiles           enable row level security;
alter table public.tenants            enable row level security;
alter table public.tenant_members     enable row level security;
alter table public.tenant_fields      enable row level security;
alter table public.entries            enable row level security;
alter table public.intake_submissions enable row level security;
alter table public.change_requests    enable row level security;
alter table public.email_log          enable row level security;

-- ── profiles ────────────────────────────────────────────────────────────────

create policy "profiles: read own"
  on public.profiles for select
  using (id = auth.uid() or public.is_operator());

create policy "profiles: update own"
  on public.profiles for update
  using (id = auth.uid())
  -- Nobody promotes themselves to operator through the API. is_operator() is
  -- SECURITY DEFINER, so reading the current value here does not re-enter this
  -- policy — an inline subquery on profiles would recurse and error.
  with check (id = auth.uid() and is_operator = public.is_operator());

-- ── tenants ─────────────────────────────────────────────────────────────────

create policy "tenants: members read"
  on public.tenants for select
  using (public.is_member_of(id) or public.is_operator());

create policy "tenants: owner updates"
  on public.tenants for update
  using (public.is_owner_of(id) or public.is_operator())
  with check (public.is_owner_of(id) or public.is_operator());

create policy "tenants: operator inserts"
  on public.tenants for insert
  with check (public.is_operator());

-- ── tenant_members ──────────────────────────────────────────────────────────

create policy "members: read own tenant"
  on public.tenant_members for select
  using (public.is_member_of(tenant_id) or public.is_operator());

create policy "members: owner manages"
  on public.tenant_members for insert
  with check (public.is_owner_of(tenant_id) or public.is_operator());

create policy "members: owner updates"
  on public.tenant_members for update
  using (public.is_owner_of(tenant_id) or public.is_operator())
  with check (public.is_owner_of(tenant_id) or public.is_operator());

create policy "members: owner removes"
  on public.tenant_members for delete
  using (public.is_owner_of(tenant_id) or public.is_operator());

-- ── tenant_fields ───────────────────────────────────────────────────────────
-- Members read the schema (the app is rendered from it). Only operators change
-- it — that is the "reply to any email and a person handles it" promise.

create policy "fields: members read"
  on public.tenant_fields for select
  using (public.is_member_of(tenant_id) or public.is_operator());

create policy "fields: operator writes"
  on public.tenant_fields for all
  using (public.is_operator())
  with check (public.is_operator());

-- ── entries ─────────────────────────────────────────────────────────────────

create policy "entries: members read"
  on public.entries for select
  using (
    deleted_at is null
    and (public.is_member_of(tenant_id) or public.is_operator())
  );

-- Owners can also see the 30-day soft-delete recycle bin.
create policy "entries: owner reads deleted"
  on public.entries for select
  using (public.is_owner_of(tenant_id) or public.is_operator());

create policy "entries: members insert"
  on public.entries for insert
  with check (public.is_member_of(tenant_id) or public.is_operator());

create policy "entries: members update"
  on public.entries for update
  using (public.is_member_of(tenant_id) or public.is_operator())
  with check (public.is_member_of(tenant_id) or public.is_operator());

-- Hard delete is reserved; the app soft-deletes via update.
create policy "entries: owner deletes"
  on public.entries for delete
  using (public.is_owner_of(tenant_id) or public.is_operator());

-- ── intake_submissions ──────────────────────────────────────────────────────

create policy "intake: anyone submits"
  on public.intake_submissions for insert
  to anon, authenticated
  with check (true);

create policy "intake: operator reads"
  on public.intake_submissions for select
  using (public.is_operator());

create policy "intake: operator writes"
  on public.intake_submissions for update
  using (public.is_operator())
  with check (public.is_operator());

-- ── change_requests ─────────────────────────────────────────────────────────

create policy "changes: members read own"
  on public.change_requests for select
  using (public.is_member_of(tenant_id) or public.is_operator());

create policy "changes: members file"
  on public.change_requests for insert
  with check (public.is_member_of(tenant_id) or public.is_operator());

create policy "changes: operator resolves"
  on public.change_requests for update
  using (public.is_operator())
  with check (public.is_operator());

-- ── email_log ───────────────────────────────────────────────────────────────
-- Written server-side with the service role only; readable by operators.

create policy "emails: operator reads"
  on public.email_log for select
  using (public.is_operator());

-- ═══════════════════════════════════════════════════════════════════════════
-- Storage
-- ═══════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'intake',
  'intake',
  false,
  52428800, -- 50 MB
  array[
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.apple.numbers',
    'application/zip',
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/heic',
    'image/webp'
  ]
)
on conflict (id) do nothing;

-- Photos attached to log entries, namespaced by tenant id.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'entry-photos',
  'entry-photos',
  false,
  20971520, -- 20 MB
  array['image/png', 'image/jpeg', 'image/heic', 'image/webp']
)
on conflict (id) do nothing;

-- Deliberately NO anon insert policy on the intake bucket.
--
-- /start uploads via a one-time signed URL minted server-side, and signed
-- uploads are authorised by their token rather than by RLS. A broad
-- "anon can insert into intake" policy would therefore buy nothing and hand
-- the internet an open file drop.
create policy "intake: operator reads"
  on storage.objects for select
  using (bucket_id = 'intake' and public.is_operator());

-- Entry photos live under <tenant_id>/..., so membership is a path prefix check.
-- The regex guard matters: casting a non-uuid folder name would raise instead of
-- cleanly denying, so a junk path like `entry-photos/x/p.png` errors the query.
create policy "photos: members read"
  on storage.objects for select
  using (
    bucket_id = 'entry-photos'
    and (storage.foldername(name))[1] ~
      '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.is_member_of(((storage.foldername(name))[1])::uuid)
  );

create policy "photos: members upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'entry-photos'
    and (storage.foldername(name))[1] ~
      '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.is_member_of(((storage.foldername(name))[1])::uuid)
  );

-- ┌──────────────────────────────────────────────────────────────────────
-- │ 20260728000200_seed_demo.sql
-- └──────────────────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════════════════════════════════════
-- Demo tenant + an ops queue to look at on a fresh install.
--
-- The demo tenant is not throwaway data: it is what the landing page and the
-- /demo route render, so it ships with the app. Everything here is idempotent
-- so re-running migrations never duplicates it.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  t_id uuid;
begin
  insert into public.tenants (
    slug, name, log_label, status, owner_name, owner_email,
    hero_label, hero_field_key, hero_field_value,
    source_file_name, source_row_count, notes, activated_at
  )
  values (
    'sample-contracting',
    'Sample Contracting Co.',
    'TOOL LOG',
    'active',
    'Sofia H.',
    'sofia@example.com',
    'TOOLS CHECKED OUT RIGHT NOW',
    'status',
    'Checked out',
    'tools-2026.xlsx',
    87,
    'demo tenant rendered on the landing page',
    now()
  )
  on conflict (slug) do nothing;

  select id into t_id from public.tenants where slug = 'sample-contracting';

  -- ── schema ────────────────────────────────────────────────────────────────
  insert into public.tenant_fields
    (tenant_id, key, label, type, required, on_card, options, is_title, is_status, position)
  values
    (t_id, 'tool',   'Tool',        'text',     true,  true,  '{}', true,  false, 0),
    (t_id, 'serial', 'Serial',      'text',     false, false, '{}', false, false, 1),
    (t_id, 'who',    'Assigned to', 'dropdown', true,  true,
       array['Marcus', 'Ray', 'Denise', 'T.J.'], false, false, 2),
    (t_id, 'site',   'Job site',    'dropdown', true,  true,
       array['Hilldale', 'Route 9 remodel', 'Shop'], false, false, 3),
    (t_id, 'status', 'Status',      'dropdown', true,  true,
       array['Checked out', 'Returned', 'Missing'], false, true, 4),
    (t_id, 'seen',   'Last seen',   'date',     false, false, '{}', false, false, 5)
  on conflict (tenant_id, key) do nothing;

  -- ── crew ──────────────────────────────────────────────────────────────────
  insert into public.tenant_members
    (tenant_id, display_name, role, status, joined_at, last_log_at)
  select t_id, v.name, v.role::public.member_role, 'active', now() - interval '120 days', v.last_log
    from (values
      ('Sofia H.', 'owner', now() - interval '3 hours'),
      ('Marcus',   'crew',  now() - interval '4 hours'),
      ('Ray',      'crew',  now() - interval '1 day'),
      ('Denise',   'crew',  now() - interval '2 days'),
      ('T.J.',     'crew',  now() - interval '3 days')
    ) as v(name, role, last_log)
   where not exists (
     select 1 from public.tenant_members m
      where m.tenant_id = t_id and m.display_name = v.name
   );

  -- ── entries ───────────────────────────────────────────────────────────────
  insert into public.entries
    (tenant_id, entry_no, data, title, status_value, occurred_on,
     created_by_name, created_at)
  select
    t_id, v.no,
    jsonb_build_object(
      'tool', v.tool, 'who', v.who, 'site', v.site, 'status', v.status
    ),
    v.tool, v.status, v.created::date, v.who, v.created
  from (values
    (1, 'DeWalt rotary hammer',   'Marcus', 'Hilldale',        'Checked out', now() - interval '4 hours'),
    (2, 'Stihl MS 271 chainsaw',  'Ray',    'Hilldale',        'Checked out', now() - interval '5 hours'),
    (3, 'Extension ladder 28"',   'Denise', 'Route 9 remodel', 'Checked out', now() - interval '1 day'),
    (4, 'DeWalt drill (20V)',     'T.J.',   'Shop',            'Returned',    now() - interval '1 day 2 hours'),
    (5, 'Bosch laser level',      'Marcus', 'Route 9 remodel', 'Checked out', now() - interval '4 days'),
    (6, 'Wacker plate compactor', 'Ray',    'Hilldale',        'Returned',    now() - interval '6 days')
  ) as v(no, tool, who, site, status, created)
  on conflict (tenant_id, entry_no) do nothing;
end $$;

-- ── other tenants, for the ops tenant list ──────────────────────────────────

insert into public.tenants
  (slug, name, log_label, status, owner_name, owner_email, notes,
   source_file_name, source_row_count, activated_at, preview_expires_at)
values
  ('marek-electric', 'Marek Electric', 'TOOL LOG', 'active',
   'Sam Rivera', 'sam@marekelectric.com', 'second demo dataset',
   'marek-tools.xlsx', 64, now() - interval '40 days', null),
  ('pruitt-landscape', 'Pruitt Landscape', 'EQUIPMENT LOG', 'preview',
   'Gary Pruitt', 'gary@pruittlandscape.com', 'preview sent, no activation yet — nudge Fri',
   'tool inventory FINAL(2).xlsx', 41, null, now() + interval '5 days'),
  ('kettle-creek-plumbing', 'Kettle Creek Plumbing', 'JOB LOG', 'churned',
   'Dale Kettle', 'dale@kettlecreek.com', 'sold the business. CSV delivered.',
   'jobs.csv', 210, now() - interval '150 days', null),
  ('boucher-rentals', 'Boucher Rentals', 'RENTAL LOG', 'active',
   'Renee Boucher', 'renee@boucherrentals.ca', 'rentals — wants a due-back column',
   '3 sheets (zip)', 133, now() - interval '9 days', null)
on conflict (slug) do nothing;

-- ── intake queue ────────────────────────────────────────────────────────────

insert into public.intake_submissions
  (name, email, notes, file_name, by_email, status, created_at)
values
  ('Gary Pruitt', 'gary@pruittlandscape.com',
   'the ''location'' column is truck numbers',
   'tool inventory FINAL(2).xlsx', false, 'queued', now() - interval '41 hours'),
  ('Dana Okafor', 'dana@okaforhvac.com',
   'photo only — call if unreadable',
   'IMG_4482.jpg (whiteboard)', false, 'queued', now() - interval '29 hours'),
  ('Mike Salazar', 'mike.salazar.electric@gmail.com',
   null, 'equipment log.csv', false, 'queued', now() - interval '12 hours'),
  ('Renee Boucher', 'renee@boucherrentals.ca',
   'rentals — needs a due-back date column',
   '3 sheets (zip)', false, 'queued', now() - interval '3 hours')
on conflict do nothing;

-- ── change requests ─────────────────────────────────────────────────────────

insert into public.change_requests (tenant_id, requester, requester_email, body, created_at)
select t.id, v.requester, v.email, v.body, v.created
  from (values
    ('boucher-rentals', 'Renee Boucher', 'renee@boucherrentals.ca',
     'Add a ''Due back'' date column to rentals', now() - interval '2 hours'),
    ('sample-contracting', 'Sofia H.', 'sofia@example.com',
     'Rename ''Job site'' options — Hilldale wrapped up', now() - interval '5 hours'),
    ('sample-contracting', 'Sofia H.', 'sofia@example.com',
     'Add T.J.''s brother to the crew dropdown', now() - interval '1 day')
  ) as v(slug, requester, email, body, created)
  join public.tenants t on t.slug = v.slug
 where not exists (
   select 1 from public.change_requests c where c.body = v.body
 );

-- ┌──────────────────────────────────────────────────────────────────────
-- │ 20260728010000_custom_apps.sql
-- └──────────────────────────────────────────────────────────────────────

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
  ('open', 'done', 'wont_do', 'needs_quote', 'needs_clarification');

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
  prompt_id     text,
  prompt_label  text,
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

-- ── tenant operations and scoped API ───────────────────────────────────────

alter table public.tenants
  add column stripe_customer_id text,
  add column stripe_subscription_id text,
  add column billing_status text not null default 'not_started'
    check (billing_status in ('not_started', 'trialing', 'active', 'past_due', 'canceled')),
  add column monthly_price_cents integer not null default 1000
    check (monthly_price_cents >= 0),
  add column api_rate_limit_per_minute integer not null default 60
    check (api_rate_limit_per_minute between 1 and 10000),
  add column current_period_start timestamptz,
  add column current_period_end timestamptz;

create table public.tenant_api_keys (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  key_prefix text not null,
  key_hash text not null unique,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.tenant_api_usage (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  api_key_id uuid references public.tenant_api_keys(id) on delete set null,
  route text not null,
  method text not null,
  status_code integer not null,
  occurred_at timestamptz not null default now()
);

create index tenant_api_keys_tenant_idx
  on public.tenant_api_keys(tenant_id, created_at desc);
create index tenant_api_usage_window_idx
  on public.tenant_api_usage(tenant_id, occurred_at desc);

alter table public.tenant_api_keys enable row level security;
alter table public.tenant_api_usage enable row level security;

create policy "tenant api keys: operator only"
  on public.tenant_api_keys for all
  using (public.is_operator())
  with check (public.is_operator());
create policy "tenant api usage: operator reads"
  on public.tenant_api_usage for select
  using (public.is_operator());

create or replace function public.enforce_tenant_storage_limit()
returns trigger
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  target_tenant uuid;
  limit_bytes bigint;
  used_bytes bigint;
  incoming_bytes bigint;
begin
  if new.bucket_id <> 'entry-photos' then return new; end if;
  target_tenant := split_part(new.name, '/', 1)::uuid;
  select storage_limit_mb::bigint * 1024 * 1024 into limit_bytes
    from public.tenants where id = target_tenant;
  if limit_bytes is null then raise exception 'Unknown tenant storage path'; end if;
  select coalesce(sum(coalesce((metadata ->> 'size')::bigint, 0)), 0)
    into used_bytes from storage.objects
   where bucket_id = 'entry-photos'
     and name like target_tenant::text || '/%'
     and id <> new.id;
  incoming_bytes := coalesce((new.metadata ->> 'size')::bigint, 0);
  if used_bytes + incoming_bytes > limit_bytes then
    raise exception 'Tenant storage limit exceeded';
  end if;
  return new;
end;
$$;

create trigger entry_photos_tenant_storage_limit
before insert or update of metadata, name on storage.objects
for each row execute function public.enforce_tenant_storage_limit();

-- ┌──────────────────────────────────────────────────────────────────────
-- │ 20260728030000_get_preview_bundle.sql
-- └──────────────────────────────────────────────────────────────────────

create or replace function public.get_preview_bundle(
  p_slug text,
  p_token uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant public.tenants%rowtype;
  v_fields jsonb;
  v_entries jsonb;
  v_members jsonb;
begin
  select * into v_tenant
    from public.tenants
   where slug = p_slug
     and preview_token = p_token;

  if not found then
    return jsonb_build_object('valid', false, 'reason', 'not_found');
  end if;

  if v_tenant.preview_expires_at is not null and v_tenant.preview_expires_at <= now() then
    return jsonb_build_object(
      'valid', false,
      'reason', 'expired',
      'tenant', jsonb_build_object(
        'slug', v_tenant.slug,
        'name', v_tenant.name,
        'preview_expires_at', v_tenant.preview_expires_at
      )
    );
  end if;

  select coalesce(jsonb_agg(to_jsonb(f) order by f.position), '[]'::jsonb)
    into v_fields
    from public.tenant_fields f
   where f.tenant_id = v_tenant.id;

  select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at desc), '[]'::jsonb)
    into v_entries
    from (
      select * from public.entries
       where tenant_id = v_tenant.id
         and deleted_at is null
       order by created_at desc
       limit 200
    ) e;

  select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb)
    into v_members
    from public.tenant_members m
   where m.tenant_id = v_tenant.id
     and m.status <> 'removed';

  return jsonb_build_object(
    'valid', true,
    'tenant', to_jsonb(v_tenant),
    'fields', v_fields,
    'entries', v_entries,
    'members', v_members
  );
end;
$$;

grant execute on function public.get_preview_bundle(text, uuid) to anon, authenticated;
