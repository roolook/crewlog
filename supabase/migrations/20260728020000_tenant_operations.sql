-- Operator billing, usage and tenant-scoped public API.

alter table public.tenants
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists billing_status text not null default 'not_started'
    check (billing_status in ('not_started', 'trialing', 'active', 'past_due', 'canceled')),
  add column if not exists monthly_price_cents integer not null default 1000
    check (monthly_price_cents >= 0),
  add column if not exists api_rate_limit_per_minute integer not null default 60
    check (api_rate_limit_per_minute between 1 and 10000),
  add column if not exists current_period_start timestamptz,
  add column if not exists current_period_end timestamptz;

create table if not exists public.tenant_api_keys (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  key_prefix text not null,
  key_hash text not null unique,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists tenant_api_keys_tenant_idx
  on public.tenant_api_keys(tenant_id, created_at desc);

create table if not exists public.tenant_api_usage (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  api_key_id uuid references public.tenant_api_keys(id) on delete set null,
  route text not null,
  method text not null,
  status_code integer not null,
  occurred_at timestamptz not null default now()
);

create index if not exists tenant_api_usage_window_idx
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

comment on table public.tenant_api_keys is
  'Revocable tenant-scoped API credentials. Only a SHA-256 hash is retained.';
comment on table public.tenant_api_usage is
  'Request audit used for per-tenant rate enforcement and operator usage reporting.';

-- Enforce each tenant's storage allowance at the database boundary. Object
-- paths are tenant-id/field-key/file, as required by the existing RLS policy.
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
  if new.bucket_id <> 'entry-photos' then
    return new;
  end if;
  begin
    target_tenant := split_part(new.name, '/', 1)::uuid;
  exception when others then
    raise exception 'Invalid tenant storage path';
  end;

  select storage_limit_mb::bigint * 1024 * 1024
    into limit_bytes
    from public.tenants
   where id = target_tenant;
  if limit_bytes is null then
    raise exception 'Unknown tenant storage path';
  end if;

  select coalesce(sum(coalesce((metadata ->> 'size')::bigint, 0)), 0)
    into used_bytes
    from storage.objects
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

drop trigger if exists entry_photos_tenant_storage_limit on storage.objects;
create trigger entry_photos_tenant_storage_limit
before insert or update of metadata, name on storage.objects
for each row execute function public.enforce_tenant_storage_limit();
