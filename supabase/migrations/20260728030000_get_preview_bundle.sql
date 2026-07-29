-- RPC function for secure preview bundle loading without supabaseAdmin
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
