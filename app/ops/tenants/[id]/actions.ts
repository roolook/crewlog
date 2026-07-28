"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireOperator } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { parseAppTheme, THEME_FIELD_KEY } from "@/lib/app-theme";
import {
  APP_BLUEPRINT_FIELD_KEY,
  parseAppBlueprint,
  type AppBlueprint,
} from "@/lib/app-blueprint";
import type { AppTheme } from "@/lib/app-theme";
import type { FieldType, PlanTier, TenantStatus } from "@/lib/types";

export type EditableField = {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  on_card: boolean;
  options: string[];
  is_title: boolean;
  is_status: boolean;
};

export async function saveTenantBuild(input: {
  tenantId: string;
  name: string;
  logLabel: string;
  heroLabel: string;
  status: TenantStatus;
  planTier: PlanTier;
  monthlyPriceCents: number;
  storageLimitMb: number;
  apiRateLimit: number;
  notes: string;
  fields: EditableField[];
  theme: AppTheme;
  blueprint: AppBlueprint | null;
}) {
  await requireOperator();
  const theme = parseAppTheme(input.theme);
  if (!theme) return { ok: false as const, error: "The design tokens are invalid." };
  const blueprint = input.blueprint
    ? parseAppBlueprint(JSON.stringify(input.blueprint))
    : null;
  if (input.blueprint && !blueprint) {
    return { ok: false as const, error: "The app bundle is incomplete or unsafe." };
  }
  const fields = input.fields.filter((field) => field.label.trim());
  if (!fields.some((field) => field.is_title)) {
    return { ok: false as const, error: "One field must be the card title." };
  }
  if (fields.filter((field) => field.is_status).length > 1) {
    return { ok: false as const, error: "Only one field can be the status." };
  }

  const admin = supabaseAdmin();
  const statusField = fields.find((field) => field.is_status);
  const { error: tenantError } = await admin
    .from("tenants")
    .update({
      name: input.name.trim(),
      log_label: input.logLabel.trim().toUpperCase() || "LOG",
      hero_label: input.heroLabel.trim().toUpperCase() || "ENTRIES THIS WEEK",
      hero_field_key: statusField?.key ?? null,
      hero_field_value: statusField?.options[0] ?? null,
      status: input.status,
      plan_tier: input.planTier,
      monthly_price_cents: Math.max(0, Math.round(input.monthlyPriceCents)),
      storage_limit_mb: Math.max(1, Math.round(input.storageLimitMb)),
      api_rate_limit_per_minute: Math.min(
        10_000,
        Math.max(1, Math.round(input.apiRateLimit)),
      ),
      notes: input.notes.trim() || null,
    })
    .eq("id", input.tenantId);
  if (tenantError) return { ok: false as const, error: tenantError.message };

  const rows = fields.map((field, position) => ({
    tenant_id: input.tenantId,
    ...field,
    label: field.label.trim(),
    position,
    options: field.type === "dropdown" ? field.options : [],
  }));
  rows.push({
    tenant_id: input.tenantId,
    key: THEME_FIELD_KEY,
    label: "APP THEME",
    type: "text" as const,
    required: false,
    on_card: false,
    options: [JSON.stringify(theme)],
    is_title: false,
    is_status: false,
    position: fields.length,
  });
  if (blueprint) {
    rows.push({
      tenant_id: input.tenantId,
      key: APP_BLUEPRINT_FIELD_KEY,
      label: "APP BLUEPRINT",
      type: "text" as const,
      required: false,
      on_card: false,
      options: [JSON.stringify(blueprint)],
      is_title: false,
      is_status: false,
      position: fields.length + 1,
    });
  }

  const { error: upsertError } = await admin
    .from("tenant_fields")
    .upsert(rows, { onConflict: "tenant_id,key" });
  if (upsertError) return { ok: false as const, error: upsertError.message };

  const keep = new Set(rows.map((row) => row.key));
  const { data: stored, error: storedError } = await admin
    .from("tenant_fields")
    .select("id, key")
    .eq("tenant_id", input.tenantId);
  if (storedError) return { ok: false as const, error: storedError.message };
  const removedIds = (stored ?? [])
    .filter((row) => !keep.has(row.key))
    .map((row) => row.id);
  if (removedIds.length) {
    const { error: deleteError } = await admin
      .from("tenant_fields")
      .delete()
      .in("id", removedIds);
    if (deleteError) return { ok: false as const, error: deleteError.message };
  }

  revalidatePath(`/ops/tenants/${input.tenantId}`);
  revalidatePath(`/app`);
  return { ok: true as const };
}

export async function createTenantApiKey(tenantId: string, name: string) {
  await requireOperator();
  const secret = randomBytes(24).toString("base64url");
  const prefix = randomBytes(4).toString("hex");
  const token = `cl_live_${prefix}_${secret}`;
  const { error } = await supabaseAdmin().from("tenant_api_keys").insert({
    tenant_id: tenantId,
    name: name.trim() || "Integration",
    key_prefix: `cl_live_${prefix}`,
    key_hash: createHash("sha256").update(token).digest("hex"),
  });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/ops/tenants/${tenantId}`);
  return { ok: true as const, token };
}

export async function revokeTenantApiKey(tenantId: string, keyId: string) {
  await requireOperator();
  const { error } = await supabaseAdmin()
    .from("tenant_api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .eq("id", keyId);
  revalidatePath(`/ops/tenants/${tenantId}`);
  return error
    ? { ok: false as const, error: error.message }
    : { ok: true as const };
}
