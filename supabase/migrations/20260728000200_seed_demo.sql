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
