"use server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { receivedEmail } from "@/lib/email/templates";
import { capabilityById } from "@/lib/capabilities";
import { slugify } from "@/lib/format";

/** Extensions we'd actually try to parse as data. Everything else is context. */
const SHEET_EXT = /\.(xlsx|xlsm|xls|csv|tsv|numbers)$/i;

/**
 * Hands the browser a one-time signed URL so files go straight to Supabase
 * Storage. Uploading through a server action instead would cap each file at
 * Vercel's ~4.5 MB request body limit, and phone photos blow past that
 * routinely.
 *
 * Called once per file, so a customer sending a zip of sheets plus four
 * whiteboard photos gets four independent uploads that can fail independently.
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

export type UploadedFile = {
  path: string;
  fileName: string;
  fileSize: number;
  mimeType?: string;
};

export type IntakeResult =
  | {
      ok: true;
      workOrder: string;
      fileNames: string[];
      requestCount: number;
      name: string;
      email: string;
    }
  | { ok: false; error: string };

/**
 * Records the submission, its attachments, and every capability the customer
 * asked for, then fires the "got your spreadsheet" email. Files are already in
 * storage by this point - this writes the paperwork.
 */
export async function submitIntake(input: {
  name: string;
  email: string;
  files: UploadedFile[];
  /** Ticked pick-list capability ids. */
  capabilities: string[];
  /** Answers to the two prompts, plus anything they typed freely. */
  answers: Record<string, string>;
  byEmail?: boolean;
}): Promise<IntakeResult> {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const files = input.files ?? [];

  if (!name) {
    return { ok: false, error: "Add your name so we know who to write back to." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return { ok: false, error: "That email doesn't look right - check it?" };
  }
  if (files.length === 0 && !input.byEmail) {
    return {
      ok: false,
      error: "Attach at least one file, or choose to send it by email instead.",
    };
  }

  // Free-text answers become the submission note; the pick-list becomes rows.
  const noteParts = Object.entries(input.answers ?? {})
    .map(([, v]) => v?.trim())
    .filter((v): v is string => !!v);
  const notes = noteParts.join("\n\n").slice(0, 4000) || null;

  try {
    const admin = supabaseAdmin();

    // The file we'd try to parse: first spreadsheet-shaped name, else the first
    // upload. The operator can override this on the build screen.
    const primaryIndex = Math.max(
      0,
      files.findIndex((f) => SHEET_EXT.test(f.fileName)),
    );

    const { data: submission, error } = await admin
      .from("intake_submissions")
      .insert({
        name,
        email,
        notes,
        by_email: files.length === 0,
        status: "queued",
      })
      .select("id, created_at")
      .single();

    if (error || !submission) {
      return {
        ok: false,
        error:
          "We couldn't file that. Email build@crewlog.app and we'll pick it up by hand.",
      };
    }

    if (files.length > 0) {
      const { error: attachError } = await admin.from("intake_attachments").insert(
        files.map((f, i) => ({
          submission_id: submission.id,
          path: f.path,
          file_name: f.fileName.slice(0, 200),
          file_size: f.fileSize,
          mime_type: f.mimeType ?? null,
          is_primary: i === primaryIndex,
          position: i,
        })),
      );
      // The files are safely in storage; losing the index rows would strand
      // them, so surface it rather than pretending the submission is complete.
      if (attachError) {
        return {
          ok: false,
          error:
            "Your files uploaded but we couldn't attach them to the order. Email build@crewlog.app and we'll sort it.",
        };
      }
    }

    // One row per ask, so nothing said on this form gets lost on the way to the
    // build screen. Free-text answers are recorded too - they're where the
    // genuinely bespoke requests live.
    const requests: { capability: string | null; body: string }[] = [];
    for (const id of input.capabilities ?? []) {
      const cap = capabilityById(id);
      if (cap && cap.id !== "something_else") {
        requests.push({ capability: cap.id, body: cap.label });
      }
    }
    for (const [promptId, value] of Object.entries(input.answers ?? {})) {
      const text = value?.trim();
      if (text) requests.push({ capability: null, body: text.slice(0, 2000) });
    }

    if (requests.length > 0) {
      await admin.from("intake_requests").insert(
        requests.map((r) => ({
          submission_id: submission.id,
          capability: r.capability,
          body: r.body,
        })),
      );
    }

    const { count } = await admin
      .from("intake_submissions")
      .select("id", { count: "exact", head: true });

    await sendEmail(
      receivedEmail({
        name,
        fileName: files[primaryIndex]?.fileName ?? null,
        fileCount: files.length,
        requestCount: requests.length,
      }),
      email,
    );

    return {
      ok: true,
      workOrder: "Nº " + String((count ?? 1) + 48).padStart(4, "0"),
      fileNames: files.map((f) => f.fileName),
      requestCount: requests.length,
      name,
      email,
    };
  } catch (e) {
    console.error("submitIntake failed", e);
    return {
      ok: false,
      error:
        "Something broke on our end. Email build@crewlog.app - that always works.",
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
