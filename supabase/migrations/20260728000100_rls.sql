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
  -- Nobody promotes themselves to operator through the API.
  with check (id = auth.uid() and is_operator = (
    select p.is_operator from public.profiles p where p.id = auth.uid()
  ));

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

-- Anonymous visitors upload their spreadsheet during intake but can never list
-- or read the bucket back. Operators read everything via the service role.
create policy "intake: anon uploads"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'intake');

create policy "intake: operator reads"
  on storage.objects for select
  using (bucket_id = 'intake' and public.is_operator());

-- Entry photos live under <tenant_id>/..., so membership is a path prefix check.
create policy "photos: members read"
  on storage.objects for select
  using (
    bucket_id = 'entry-photos'
    and public.is_member_of(((storage.foldername(name))[1])::uuid)
  );

create policy "photos: members upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'entry-photos'
    and public.is_member_of(((storage.foldername(name))[1])::uuid)
  );
