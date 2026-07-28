import { notFound, redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { themeFromFields } from "@/lib/app-theme";
import { CUSTOM_HTML_FIELD_KEY } from "@/lib/custom-html";
import type { MemberRole, TenantBundle } from "@/lib/types";

/** Emails allowed into /ops, from OPERATOR_EMAILS. */
export function operatorEmails(): string[] {
  return (process.env.OPERATOR_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Gate for the ops console. Two ways in: the profile row says is_operator, or
 * the email is on the OPERATOR_EMAILS allowlist (which also covers the very
 * first login, before anyone has flipped the flag).
 *
 * Unauthorised visitors get a 404 rather than a 403 - the console isn't
 * something we want to confirm exists.
 */
export async function requireOperator() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/ops");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_operator, email, full_name")
    .eq("id", user.id)
    .maybeSingle();

  const allowlisted = operatorEmails().includes(
    (user.email ?? "").toLowerCase(),
  );

  if (!profile?.is_operator && !allowlisted) notFound();

  return { user, profile };
}

/**
 * Load a tenant and everything its app shell renders, scoped to the viewer.
 * Returns null when the tenant does not exist or the viewer is not a member -
 * RLS makes those two cases indistinguishable, which is what we want.
 */
export async function loadTenantBundle(
  slug: string,
): Promise<TenantBundle | null> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: tenant } = await supabase
    .from("tenants")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (!tenant) return null;

  const [{ data: fields }, { data: entries }, { data: members }] =
    await Promise.all([
      supabase
        .from("tenant_fields")
        .select("*")
        .eq("tenant_id", tenant.id)
        .order("position"),
      supabase
        .from("entries")
        .select("*")
        .eq("tenant_id", tenant.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("tenant_members")
        .select("*")
        .eq("tenant_id", tenant.id)
        .neq("status", "removed")
        .order("role")
        .order("created_at"),
    ]);

  const me = (members ?? []).find((m) => m.user_id === user.id);
  const themed = themeFromFields(fields ?? []);
  const customHtml =
    (fields ?? []).find((field) => field.key === CUSTOM_HTML_FIELD_KEY)
      ?.options?.[0] ?? null;

  return {
    tenant,
    theme: themed.theme,
    customHtml,
    fields: themed.fields,
    entries: entries ?? [],
    members: members ?? [],
    viewerRole: (me?.role as MemberRole | undefined) ?? null,
    viewerName: me?.display_name ?? user.email ?? "you",
  };
}

/** The tenants a signed-in user belongs to, most recent first. */
export async function myTenants() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("tenant_members")
    .select("role, tenants(*)")
    .eq("user_id", user.id)
    .eq("status", "active");

  return (data ?? [])
    .map((r) => r.tenants)
    .filter(Boolean)
    .flat();
}
