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
  created_at   timestamptz not null default now()
);

create index intake_status_idx on public.intake_submissions (status, created_at);

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
