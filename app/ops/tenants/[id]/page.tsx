import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { themeFromFields, THEME_FIELD_KEY } from "@/lib/app-theme";
import {
  APP_BLUEPRINT_FIELD_KEY,
  parseAppBlueprint,
} from "@/lib/app-blueprint";
import type { Tenant, TenantField } from "@/lib/types";
import { TenantManager } from "./TenantManager";

export const dynamic = "force-dynamic";

export default async function TenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = supabaseAdmin();
  const [
    { data: tenant },
    { data: rawFields },
    { data: members },
    { count: entries },
    { count: apiMonth },
    { data: apiKeys },
  ] = await Promise.all([
    admin.from("tenants").select("*").eq("id", id).maybeSingle(),
    admin.from("tenant_fields").select("*").eq("tenant_id", id).order("position"),
    admin
      .from("tenant_members")
      .select("id, display_name, email, role, status, last_log_at")
      .eq("tenant_id", id)
      .order("created_at"),
    admin
      .from("entries")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", id)
      .is("deleted_at", null),
    admin
      .from("tenant_api_usage")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", id)
      .gte("occurred_at", new Date(Date.now() - 30 * 86_400_000).toISOString()),
    admin
      .from("tenant_api_keys")
      .select("id, name, key_prefix, last_used_at, revoked_at, created_at")
      .eq("tenant_id", id)
      .order("created_at", { ascending: false }),
  ]);
  if (!tenant) notFound();
  const storageBytes = await tenantStorageBytes(admin, id);

  const allFields = (rawFields ?? []) as TenantField[];
  const { fields, theme } = themeFromFields(allFields);
  const blueprintRaw = allFields.find(
    (field) => field.key === APP_BLUEPRINT_FIELD_KEY,
  )?.options[0];
  const blueprint = blueprintRaw ? parseAppBlueprint(blueprintRaw) : null;

  return (
    <TenantManager
      tenant={tenant as Tenant & {
        monthly_price_cents?: number;
        billing_status?: string;
        api_rate_limit_per_minute?: number;
        current_period_start?: string | null;
        current_period_end?: string | null;
      }}
      fields={fields.filter((field) => field.key !== THEME_FIELD_KEY)}
      theme={theme}
      blueprint={blueprint}
      members={members ?? []}
      usage={{ entries: entries ?? 0, apiMonth: apiMonth ?? 0, storageBytes }}
      apiKeys={apiKeys ?? []}
    />
  );
}

async function tenantStorageBytes(
  admin: ReturnType<typeof supabaseAdmin>,
  tenantId: string,
) {
  const { data: folders } = await admin.storage
    .from("entry-photos")
    .list(tenantId, { limit: 1000 });
  let bytes = 0;
  await Promise.all(
    (folders ?? []).map(async (folder) => {
      const directSize = Number(folder.metadata?.size ?? 0);
      if (directSize) {
        bytes += directSize;
        return;
      }
      const { data: files } = await admin.storage
        .from("entry-photos")
        .list(`${tenantId}/${folder.name}`, { limit: 1000 });
      bytes += (files ?? []).reduce(
        (sum, file) => sum + Number(file.metadata?.size ?? 0),
        0,
      );
    }),
  );
  return bytes;
}
