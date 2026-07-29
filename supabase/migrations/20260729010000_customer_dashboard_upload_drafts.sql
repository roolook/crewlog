-- Durable intake uploads plus a tenant-scoped customer dashboard.

create table if not exists public.intake_upload_drafts (
  id uuid primary key default gen_random_uuid(),
  cleanup_token_hash text not null,
  status text not null default 'draft'
    check (status in ('draft', 'submitted')),
  submission_id uuid unique
    references public.intake_submissions(id) on delete set null,
  last_active_at timestamptz not null default now(),
  submitted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists intake_upload_drafts_cleanup_idx
  on public.intake_upload_drafts(last_active_at)
  where status = 'draft';

create table if not exists public.intake_draft_files (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null
    references public.intake_upload_drafts(id) on delete cascade,
  path text not null unique,
  file_name text not null,
  file_size bigint not null check (file_size >= 0),
  mime_type text,
  state text not null default 'waiting'
    check (state in ('waiting', 'uploaded', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists intake_draft_files_draft_idx
  on public.intake_draft_files(draft_id, created_at);

alter table public.intake_upload_drafts enable row level security;
alter table public.intake_draft_files enable row level security;

-- Drafts are intentionally server-only. The browser receives only short-lived
-- signed Storage targets and an unguessable cleanup token.
revoke all on public.intake_upload_drafts from anon, authenticated;
revoke all on public.intake_draft_files from anon, authenticated;

alter table public.intake_submissions
  add column if not exists upload_draft_id uuid unique
    references public.intake_upload_drafts(id) on delete set null;

create or replace function public.get_customer_dashboard()
returns table (
  tenant_id uuid,
  slug text,
  name text,
  status text,
  role text,
  last_activity timestamptz,
  entry_count bigint,
  storage_bytes bigint,
  storage_limit_mb integer,
  team_member_count bigint,
  plan_tier text,
  monthly_price_cents integer
)
language sql
stable
security definer
set search_path = public, storage
as $$
  select
    t.id,
    t.slug,
    t.name,
    t.status::text,
    m.role::text,
    greatest(
      t.created_at,
      coalesce((select max(e.updated_at)
                  from public.entries e
                 where e.tenant_id = t.id
                   and e.deleted_at is null), t.created_at),
      coalesce((select max(tm.last_log_at)
                  from public.tenant_members tm
                 where tm.tenant_id = t.id
                   and tm.status = 'active'), t.created_at)
    ),
    (select count(*)
       from public.entries e
      where e.tenant_id = t.id
        and e.deleted_at is null),
    (select coalesce(sum(coalesce((o.metadata ->> 'size')::bigint, 0)), 0)
       from storage.objects o
      where o.bucket_id = 'entry-photos'
        and o.name like t.id::text || '/%'),
    t.storage_limit_mb,
    (select count(*)
       from public.tenant_members tm
      where tm.tenant_id = t.id
        and tm.status = 'active'),
    t.plan_tier::text,
    t.monthly_price_cents
  from public.tenant_members m
  join public.tenants t on t.id = m.tenant_id
  where m.user_id = auth.uid()
    and m.status = 'active'
  order by 6 desc;
$$;

revoke all on function public.get_customer_dashboard() from public;
grant execute on function public.get_customer_dashboard() to authenticated;

comment on function public.get_customer_dashboard() is
  'Returns dashboard metrics only for the signed-in user tenant memberships.';
