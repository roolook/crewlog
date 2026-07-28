"use server";

import { revalidatePath } from "next/cache";
import { requireOperator } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { previewReadyEmail } from "@/lib/email/templates";
import { hoursAgo, siteUrl, slugify } from "@/lib/format";
import { parseSpreadsheet, type ParsedColumn } from "@/lib/parse";
import { coerceValue, displayValue } from "@/lib/fields";
import {
  parseAppTheme,
  THEME_FIELD_KEY,
  type AppTheme,
} from "@/lib/app-theme";
import {
  APP_BLUEPRINT_FIELD_KEY,
  parseAppBlueprint,
  type AppBlueprint,
} from "@/lib/app-blueprint";
import type {
  FieldType,
  FieldValue,
  IntakeRequest,
  PlanTier,
  RequestStatus,
} from "@/lib/types";

export type ColumnSpec = {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  on_card: boolean;
  options: string[];
  is_title: boolean;
  is_status: boolean;
};

/**
 * Downloads the customer's file from storage and proposes a schema. Called on
 * the server so the raw sheet never reaches the browser.
 */
export async function parseSubmission(id: string): Promise<
  | {
      ok: true;
      columns: ParsedColumn[];
      rowCount: number;
      sheetName: string;
      otherSheets: string[];
      sampleRows: Record<string, string>[];
    }
  | { ok: false; error: string }
> {
  await requireOperator();
  const admin = supabaseAdmin();

  const target = await primaryAttachment(id);
  if (!target) {
    return {
      ok: false,
      error:
        "Nothing here parses as a spreadsheet. It may have arrived by email, or it may be photos and PDFs. Add the columns by hand.",
    };
  }

  const { data: blob, error } = await admin.storage
    .from("intake")
    .download(target.path);

  if (error || !blob) {
    return { ok: false, error: error?.message ?? "Could not download that file." };
  }

  const parsed = parseSpreadsheet(await blob.arrayBuffer(), target.file_name);
  if (!parsed.ok) return parsed;

  return {
    ok: true,
    columns: parsed.columns,
    rowCount: parsed.rowCount,
    sheetName: parsed.sheetName,
    otherSheets: parsed.otherSheets,
    sampleRows: parsed.rows.slice(0, 5),
  };
}

/**
 * Which uploaded file the parser should read.
 *
 * Prefers the one the operator (or intake) flagged primary, then any
 * spreadsheet-shaped name, then falls back to the legacy single-file column so
 * submissions taken before intake_attachments existed still build.
 */
async function primaryAttachment(
  submissionId: string,
): Promise<{ path: string; file_name: string } | null> {
  const admin = supabaseAdmin();

  const { data: attachments } = await admin
    .from("intake_attachments")
    .select("path, file_name, is_primary, position")
    .eq("submission_id", submissionId)
    .order("position");

  const list = attachments ?? [];
  const chosen =
    list.find((a) => a.is_primary) ??
    list.find((a) => /\.(xlsx|xlsm|xls|csv|tsv|numbers)$/i.test(a.file_name));
  if (chosen) return { path: chosen.path, file_name: chosen.file_name };

  const { data: legacy } = await admin
    .from("intake_submissions")
    .select("file_path, file_name")
    .eq("id", submissionId)
    .maybeSingle();
  if (legacy?.file_path) {
    return { path: legacy.file_path, file_name: legacy.file_name ?? "sheet" };
  }
  return null;
}

/** Signed download links so the operator can open every attachment. */
export async function attachmentLinks(
  submissionId: string,
): Promise<{ id: string; fileName: string; size: number | null; url: string | null; isPrimary: boolean }[]> {
  await requireOperator();
  const admin = supabaseAdmin();

  const { data, error } = await admin
    .from("intake_attachments")
    .select("id, path, file_name, file_size, is_primary, position")
    .eq("submission_id", submissionId)
    .order("position");
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  return Promise.all(
    rows.map(async (a) => {
      const { data: signed } = await admin.storage
        .from("intake")
        .createSignedUrl(a.path, 3600);
      return {
        id: a.id,
        fileName: a.file_name,
        size: a.file_size,
        url: signed?.signedUrl ?? null,
        isPrimary: a.is_primary,
      };
    }),
  );
}

/** Flip which file the parser reads. */
export async function setPrimaryAttachment(
  submissionId: string,
  attachmentId: string,
) {
  await requireOperator();
  const admin = supabaseAdmin();
  const { data: previous } = await admin
    .from("intake_attachments")
    .select("id")
    .eq("submission_id", submissionId)
    .eq("is_primary", true)
    .maybeSingle();

  const { error: clearError } = await admin
    .from("intake_attachments")
    .update({ is_primary: false })
    .eq("submission_id", submissionId);
  if (clearError) return { ok: false };

  const { error } = await admin
    .from("intake_attachments")
    .update({ is_primary: true })
    .eq("submission_id", submissionId)
    .eq("id", attachmentId);
  if (error && previous?.id) {
    await admin
      .from("intake_attachments")
      .update({ is_primary: true })
      .eq("id", previous.id);
  }
  return { ok: !error };
}

/** The capability asks, for the panel beside the schema. */
export async function submissionRequests(submissionId: string) {
  await requireOperator();
  const { data, error } = await supabaseAdmin()
    .from("intake_requests")
    .select("*")
    .eq("submission_id", submissionId)
    .order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []) as IntakeRequest[];
}

/** Operator ticks each ask off by hand; replies go out by hand too. */
export async function setRequestStatus(
  requestId: string,
  status: RequestStatus,
  note?: string,
) {
  await requireOperator();
  const { error } = await supabaseAdmin()
    .from("intake_requests")
    .update({
      status,
      operator_note: note ?? null,
      resolved_at: status === "open" ? null : new Date().toISOString(),
    })
    .eq("id", requestId);
  revalidatePath("/ops");
  return { ok: !error };
}

/** Send a saved draft build without generating a duplicate tenant. */
export async function sendExistingPreview(
  submissionId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireOperator();
  const admin = supabaseAdmin();
  const { data: sub, error: subError } = await admin
    .from("intake_submissions")
    .select("id, name, email, created_at, tenant_id")
    .eq("id", submissionId)
    .maybeSingle();

  if (subError || !sub?.tenant_id) {
    return {
      ok: false,
      error: subError?.message ?? "This submission has no saved build.",
    };
  }

  const [{ data: tenant, error: tenantError }, { count: columnCount }] =
    await Promise.all([
      admin
        .from("tenants")
        .select("id, slug, preview_token, source_row_count")
        .eq("id", sub.tenant_id)
        .maybeSingle(),
      admin
        .from("tenant_fields")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", sub.tenant_id)
        .not("key", "in", `("${THEME_FIELD_KEY}","${APP_BLUEPRINT_FIELD_KEY}")`),
    ]);

  if (tenantError || !tenant) {
    return {
      ok: false,
      error: tenantError?.message ?? "The saved tenant is missing.",
    };
  }

  const previewUrl = `${siteUrl()}/preview/${tenant.slug}?t=${tenant.preview_token}`;
  const sent = await sendEmail(
    previewReadyEmail({
      name: sub.name,
      previewUrl,
      rowCount: tenant.source_row_count,
      columnCount: columnCount ?? 0,
      hours: hoursAgo(sub.created_at),
    }),
    sub.email,
    tenant.id,
  );

  if (!sent.delivered) {
    return { ok: false, error: sent.error ?? "The preview email failed." };
  }

  const { error: updateError } = await admin
    .from("intake_submissions")
    .update({ status: "preview_sent" })
    .eq("id", sub.id);
  if (updateError) return { ok: false, error: updateError.message };

  revalidatePath("/ops");
  revalidatePath(`/ops/build?id=${submissionId}`);
  return { ok: true };
}

/**
 * Creates the tenant, writes the schema, imports every row from the sheet, and
 * emails the customer their preview link. This is the "we build" step of the
 * work order, and it is one transaction from the operator's point of view.
 */
export async function generateApp(input: {
  submissionId: string;
  companyName: string;
  logLabel: string;
  heroLabel: string;
  columns: ColumnSpec[];
  sendEmail: boolean;
  planTier: PlanTier;
  /** Set to serve a hand-built app instead of the generated shell. */
  customAppKey?: string | null;
  /** Safe visual tokens for the generated shell. */
  theme: AppTheme;
  /** Complete AI-produced product and source bundle, retained for editing. */
  blueprint?: AppBlueprint | null;
}): Promise<
  | { ok: true; slug: string; previewUrl: string; imported: number; emailed: boolean }
  | { ok: false; error: string }
> {
  await requireOperator();
  const admin = supabaseAdmin();

  const { data: sub } = await admin
    .from("intake_submissions")
    .select("*")
    .eq("id", input.submissionId)
    .maybeSingle();

  if (!sub) return { ok: false, error: "That submission is gone." };
  if (sub.tenant_id) {
    const { data: existing } = await admin
      .from("tenants")
      .select("slug, preview_token, source_row_count")
      .eq("id", sub.tenant_id)
      .maybeSingle();
    if (existing) {
      return {
        ok: true,
        slug: existing.slug,
        previewUrl: `${siteUrl()}/preview/${existing.slug}?t=${existing.preview_token}`,
        imported: existing.source_row_count,
        emailed: sub.status === "preview_sent" || sub.status === "activated",
      };
    }
  }
  const companyName = input.companyName.trim();
  if (!companyName) {
    return { ok: false, error: "The company name is required." };
  }
  const safeTheme = parseAppTheme(input.theme);
  if (!safeTheme) {
    return { ok: false, error: "The app theme contains invalid design tokens." };
  }
  const safeBlueprint = input.blueprint
    ? parseAppBlueprint(JSON.stringify(input.blueprint))
    : null;
  if (input.blueprint && !safeBlueprint) {
    return { ok: false, error: "The complete app bundle is invalid or unsafe." };
  }

  const columns = input.columns.filter((col) => col.label.trim());
  if (columns.length === 0) {
    return { ok: false, error: "The app needs at least one column." };
  }
  const titleCol = columns.find((col) => col.is_title);
  if (!titleCol) {
    return { ok: false, error: "Mark one column as the card title." };
  }
  if (columns.filter((col) => col.is_status).length > 1) {
    return { ok: false, error: "Only one column can be the status." };
  }

  // A unique slug, since it's the customer-facing URL.
  const base = slugify(companyName) || "customer";
  let slug = base;
  for (let n = 2; n < 40; n++) {
    const { data: taken } = await admin
      .from("tenants")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!taken) break;
    slug = `${base}-${n}`;
  }

  const statusCol = columns.find((col) => col.is_status);

  const { data: tenant, error: tErr } = await admin
    .from("tenants")
    .insert({
      slug,
      name: companyName,
      log_label: input.logLabel.trim().toUpperCase() || "LOG",
      status: "preview",
      owner_name: sub.name,
      owner_email: sub.email,
      hero_label: input.heroLabel.trim().toUpperCase() || "ENTRIES THIS WEEK",
      hero_field_key: statusCol?.key ?? null,
      hero_field_value: statusCol?.options[0] ?? null,
      plan_tier: input.planTier,
      app_kind: input.customAppKey ? "custom" : "generated",
      custom_app_key: input.customAppKey || null,
      source_file_name: sub.file_name,
      notes: sub.notes,
      preview_expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    })
    .select("*")
    .single();

  if (tErr || !tenant) {
    return { ok: false, error: tErr?.message ?? "Could not create the tenant." };
  }

  async function rollback(error: string) {
    await admin.from("tenants").delete().eq("id", tenant.id);
    return { ok: false as const, error };
  }

  const fieldRows = columns.map((col, i) => ({
      tenant_id: tenant.id,
      key: col.key,
      label: col.label.trim(),
      type: col.type,
      required: col.required,
      on_card: col.on_card && !col.is_title,
      options: col.type === "dropdown" ? col.options : [],
      is_title: col.is_title,
      is_status: col.is_status,
      position: i,
    }));
  fieldRows.push({
    tenant_id: tenant.id,
    key: THEME_FIELD_KEY,
    label: "APP THEME",
    type: "text",
    required: false,
    on_card: false,
    options: [JSON.stringify(safeTheme)],
    is_title: false,
    is_status: false,
    position: columns.length,
  });
  if (safeBlueprint) {
    fieldRows.push({
      tenant_id: tenant.id,
      key: APP_BLUEPRINT_FIELD_KEY,
      label: "APP BLUEPRINT",
      type: "text",
      required: false,
      on_card: false,
    options: [JSON.stringify(safeBlueprint)],
      is_title: false,
      is_status: false,
      position: columns.length + 1,
    });
  }

  const { error: fErr } = await admin.from("tenant_fields").insert(fieldRows);

  if (fErr) {
    return rollback(`Schema failed: ${fErr.message}`);
  }

  // ── import the rows ───────────────────────────────────────────────────────
  let imported = 0;
  const source = await primaryAttachment(sub.id);
  if (source) {
    const { data: blob } = await admin.storage.from("intake").download(source.path);
    if (blob) {
      const parsed = parseSpreadsheet(await blob.arrayBuffer(), source.file_name);
      if (parsed.ok) {
        const rows = parsed.rows.map((row, i) => {
          const data: Record<string, FieldValue> = {};
          for (const col of columns) {
            // A capability column (map pin, photo, signature) has nothing to
            // import from a spreadsheet cell. It starts empty and the crew
            // fills it in on the phone.
            data[col.key] = coerceValue(
              col.type,
              (row[col.key] ?? "").trim(),
              col.options,
            );
          }
          return {
            tenant_id: tenant.id,
            entry_no: i + 1,
            data,
            title: displayValue(titleCol.type, data[titleCol.key] ?? null).slice(0, 300),
            status_value: statusCol
              ? displayValue(statusCol.type, data[statusCol.key] ?? null) || null
              : null,
            created_by_name: "imported from " + source.file_name,
          };
        });

        // Chunked so a large sheet doesn't blow the request size.
        for (let i = 0; i < rows.length; i += 500) {
          const { error } = await admin.from("entries").insert(rows.slice(i, i + 500));
          if (error) return rollback(`Row import failed: ${error.message}`);
          imported += Math.min(500, rows.length - i);
        }
      }
    }
  }

  const { error: tenantUpdateError } = await admin
    .from("tenants")
    .update({
      source_row_count: imported,
      source_file_name: source?.file_name ?? sub.file_name,
    })
    .eq("id", tenant.id);
  if (tenantUpdateError) {
    return rollback(`Tenant summary failed: ${tenantUpdateError.message}`);
  }

  // Carry the asks onto the tenant so they stay visible after the build.
  const { error: requestError } = await admin
    .from("intake_requests")
    .update({ tenant_id: tenant.id })
    .eq("submission_id", sub.id);
  if (requestError) {
    return rollback(`Customer requests failed: ${requestError.message}`);
  }

  // Seat the owner. user_id stays null until they follow a magic link, at which
  // point the handle_new_user trigger claims this row by email.
  const { error: memberError } = await admin.from("tenant_members").insert({
    tenant_id: tenant.id,
    display_name: sub.name,
    email: sub.email,
    role: "owner",
    status: "pending",
  });
  if (memberError) {
    return rollback(`Owner seat failed: ${memberError.message}`);
  }

  const { error: submissionError } = await admin
    .from("intake_submissions")
    .update({
      status: input.sendEmail ? "preview_sent" : "building",
      tenant_id: tenant.id,
    })
    .eq("id", sub.id);
  if (submissionError) {
    return rollback(`Intake update failed: ${submissionError.message}`);
  }

  const previewUrl = `${siteUrl()}/preview/${slug}?t=${tenant.preview_token}`;

  let emailed = false;
  if (input.sendEmail) {
    const res = await sendEmail(
      previewReadyEmail({
        name: sub.name,
        previewUrl,
        rowCount: imported,
        columnCount: columns.length,
        hours: hoursAgo(sub.created_at),
      }),
      sub.email,
      tenant.id,
    );
    emailed = res.delivered;
  }

  revalidatePath("/ops");
  revalidatePath("/ops/tenants");
  return { ok: true, slug, previewUrl, imported, emailed };
}
