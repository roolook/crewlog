"use server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { receivedEmail } from "@/lib/email/templates";
import { slugify } from "@/lib/format";

/**
 * Hands the browser a one-time signed URL so the spreadsheet goes straight to
 * Supabase Storage. Uploading through a server action instead would cap the
 * file at Vercel's ~4.5 MB request body limit, and whiteboard photos blow past
 * that routinely.
 */
export async function createUploadTarget(fileName: string): Promise<
  | { ok: true; path: string; token: string }
  | { ok: false; error: string }
> {
  const clean = fileName.replace(/[^\w.\- ]+/g, "_").slice(-120);
  const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${clean}`;

  try {
    const { data, error } = await supabaseAdmin()
      .storage.from("intake")
      .createSignedUploadUrl(path);
    if (error || !data) {
      return { ok: false, error: error?.message ?? "Could not start the upload." };
    }
    return { ok: true, path: data.path, token: data.token };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Storage is not configured yet.",
    };
  }
}

export type IntakeResult =
  | {
      ok: true;
      workOrder: string;
      fileName: string;
      name: string;
      email: string;
    }
  | { ok: false; error: string };

/**
 * Records the submission and fires the "Got your spreadsheet" email. The file
 * is already in storage by this point — this only writes the paperwork.
 */
export async function submitIntake(input: {
  name: string;
  email: string;
  notes?: string;
  filePath?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  byEmail?: boolean;
}): Promise<IntakeResult> {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();

  if (!name) return { ok: false, error: "Add your name so we know who to write back to." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return { ok: false, error: "That email doesn't look right — check it?" };
  }
  if (!input.filePath && !input.byEmail) {
    return { ok: false, error: "Attach the sheet, or choose to email it after." };
  }

  try {
    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from("intake_submissions")
      .insert({
        name,
        email,
        notes: input.notes?.trim() || null,
        file_path: input.filePath ?? null,
        file_name: input.fileName ?? null,
        file_size: input.fileSize ?? null,
        by_email: !!input.byEmail,
        status: "queued",
      })
      .select("id, created_at")
      .single();

    if (error || !data) {
      return {
        ok: false,
        error: "We couldn't file that. Email build@crewlog.app and we'll pick it up by hand.",
      };
    }

    // Work order number: sequential-ish and human, derived from the queue depth.
    const { count } = await admin
      .from("intake_submissions")
      .select("id", { count: "exact", head: true });

    await sendEmail(
      receivedEmail({ name, fileName: input.fileName ?? null }),
      email,
    );

    return {
      ok: true,
      workOrder: "Nº " + String((count ?? 1) + 48).padStart(4, "0"),
      fileName: input.byEmail
        ? "(sending by email — build@crewlog.app)"
        : (input.fileName ?? "—"),
      name,
      email,
    };
  } catch (e) {
    console.error("submitIntake failed", e);
    return {
      ok: false,
      error:
        "Something broke on our end. Email build@crewlog.app — that always works.",
    };
  }
}

/** Optional "text me when it's live" on the confirmation card. */
export async function addIntakePhone(email: string, phone: string) {
  const clean = phone.replace(/[^\d+()\-. ]/g, "").trim();
  if (!clean) return { ok: false as const };
  try {
    await supabaseAdmin()
      .from("intake_submissions")
      .update({ phone: clean })
      .eq("email", email.trim().toLowerCase())
      .is("phone", null);
    return { ok: true as const };
  } catch {
    return { ok: false as const };
  }
}

/** Reserved for the ops console: a stable slug suggestion from a company name. */
export async function suggestSlug(name: string) {
  return slugify(name);
}
