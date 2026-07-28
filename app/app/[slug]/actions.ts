"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/send";
import { crewInviteEmail } from "@/lib/email/templates";
import { siteUrl } from "@/lib/format";
import { statusField, titleField } from "@/lib/schema";
import { coerceValue, displayValue, hasValue } from "@/lib/fields";
import type { Entry, FieldValue, Member, TenantField } from "@/lib/types";

/**
 * Every action here goes through the request-scoped (anon-key) client, so RLS
 * decides what the caller may touch. Nothing trusts a tenant id from the
 * browser: we resolve the tenant from the slug and let the policies reject it.
 */

async function resolve(slug: string) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { data: tenant } = await supabase
    .from("tenants")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (!tenant) throw new Error("That log isn't available.");

  const { data: fields } = await supabase
    .from("tenant_fields")
    .select("*")
    .eq("tenant_id", tenant.id)
    .order("position");

  const { data: me } = await supabase
    .from("tenant_members")
    .select("*")
    .eq("tenant_id", tenant.id)
    .eq("user_id", user.id)
    .maybeSingle();

  return {
    supabase,
    user,
    tenant,
    fields: (fields ?? []) as TenantField[],
    me: me as Member | null,
  };
}

/**
 * Only keep keys that exist in the tenant's schema, coerced to that field's
 * storage shape. The client is never trusted to have sent the right thing — a
 * malformed pin, a dropdown value that isn't an option, or a storage path
 * pointing outside our namespace all become null here rather than being stored.
 */
function sanitise(
  values: Record<string, FieldValue>,
  fields: TenantField[],
): Record<string, FieldValue> {
  const out: Record<string, FieldValue> = {};
  for (const f of fields) {
    const raw = values[f.key];
    if (raw === undefined) continue;
    out[f.key] = coerceValue(f.type, raw, f.options);
  }
  return out;
}

function derive(
  data: Record<string, FieldValue>,
  fields: TenantField[],
) {
  const tf = titleField(fields);
  const sf = statusField(fields);
  const df = fields.find((f) => f.type === "date");
  return {
    title: tf ? displayValue(tf.type, data[tf.key] ?? null).slice(0, 300) : "",
    status_value: sf
      ? displayValue(sf.type, data[sf.key] ?? null) || null
      : null,
    occurred_on: df && data[df.key] ? String(data[df.key]) : null,
  };
}

export async function createEntryAction(
  slug: string,
  values: Record<string, FieldValue>,
): Promise<Entry> {
  const { supabase, user, tenant, fields, me } = await resolve(slug);

  const data = sanitise(values, fields);
  const derived = derive(data, fields);
  if (!derived.title) throw new Error("That entry needs a name.");

  const missing = fields.filter(
    (f) => f.required && !hasValue(f.type, data[f.key] ?? null),
  );
  if (missing.length) {
    throw new Error(`${missing.map((m) => m.label).join(", ")} still needed.`);
  }

  const { data: row, error } = await supabase
    .from("entries")
    .insert({
      tenant_id: tenant.id,
      data,
      ...derived,
      created_by: user.id,
      created_by_name: me?.display_name ?? user.email ?? "someone",
    })
    .select("*")
    .single();

  if (error || !row) throw new Error(error?.message ?? "Could not save that.");

  if (me) {
    await supabase
      .from("tenant_members")
      .update({ last_log_at: new Date().toISOString() })
      .eq("id", me.id);
  }

  revalidatePath(`/app/${slug}`);
  return row as Entry;
}

export async function updateEntryAction(
  slug: string,
  id: string,
  values: Record<string, FieldValue>,
): Promise<Entry> {
  const { supabase, tenant, fields } = await resolve(slug);

  const data = sanitise(values, fields);
  const derived = derive(data, fields);
  if (!derived.title) throw new Error("That entry needs a name.");

  const { data: row, error } = await supabase
    .from("entries")
    .update({ data, ...derived })
    .eq("id", id)
    .eq("tenant_id", tenant.id)
    .select("*")
    .single();

  if (error || !row) throw new Error(error?.message ?? "Could not save that.");
  revalidatePath(`/app/${slug}`);
  return row as Entry;
}

/** Soft delete — the app promises owners 30 days of recovery. */
export async function deleteEntryAction(slug: string, id: string) {
  const { supabase, tenant } = await resolve(slug);
  const { error } = await supabase
    .from("entries")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", tenant.id);
  if (error) throw new Error(error.message);
  revalidatePath(`/app/${slug}`);
}

/**
 * Creates a pending seat and, when the contact is an email, sends the invite.
 * A phone number still creates the seat and its token so the link can be texted
 * by hand — wiring an SMS provider is a matter of calling it right here.
 */
export async function inviteMemberAction(
  slug: string,
  contact: string,
): Promise<Member> {
  const { supabase, tenant, me } = await resolve(slug);
  if (me?.role !== "owner") throw new Error("Only the owner can invite.");

  const value = contact.trim();
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
  if (!isEmail && !/\d{7,}/.test(value.replace(/\D/g, ""))) {
    throw new Error("Use an email address or a phone number.");
  }

  const { data: row, error } = await supabase
    .from("tenant_members")
    .insert({
      tenant_id: tenant.id,
      display_name: isEmail ? value.split("@")[0] : value,
      email: isEmail ? value.toLowerCase() : null,
      phone: isEmail ? null : value,
      role: "crew",
      status: "pending",
    })
    .select("*")
    .single();

  if (error || !row) throw new Error(error?.message ?? "Could not create that invite.");

  if (isEmail) {
    // The invite token rides through login so the seat is claimed on arrival
    // even if they sign in with a different address than we invited.
    const next = `/app/${slug}`;
    const url =
      `${siteUrl()}/login?next=${encodeURIComponent(next)}` +
      `&invite=${row.invite_token}`;
    await sendEmail(
      crewInviteEmail({
        inviterName: me.display_name,
        tenantName: tenant.name,
        logLabel: tenant.log_label,
        url,
      }),
      value.toLowerCase(),
      tenant.id,
    );
  }

  revalidatePath(`/app/${slug}`);
  return row as Member;
}

export async function removeMemberAction(slug: string, memberId: string) {
  const { supabase, tenant, me } = await resolve(slug);
  if (me?.role !== "owner") throw new Error("Only the owner can remove people.");

  // Past entries stay attributed — we mark the seat removed rather than delete.
  const { error } = await supabase
    .from("tenant_members")
    .update({ status: "removed" })
    .eq("id", memberId)
    .eq("tenant_id", tenant.id)
    .neq("role", "owner");

  if (error) throw new Error(error.message);
  revalidatePath(`/app/${slug}`);
}

/** "Reply to any email from us" — filed straight into the ops queue. */
export async function fileChangeRequestAction(slug: string, body: string) {
  const { supabase, tenant, me, user } = await resolve(slug);
  const text = body.trim();
  if (!text) return { ok: false as const };

  const { error } = await supabase.from("change_requests").insert({
    tenant_id: tenant.id,
    requester: me?.display_name ?? user.email ?? "unknown",
    requester_email: user.email,
    body: text.slice(0, 2000),
  });

  return { ok: !error };
}
