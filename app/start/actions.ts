"use server";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { receivedEmail } from "@/lib/email/templates";
import {
  capabilityById,
  INTAKE_PROMPTS,
} from "@/lib/capabilities";
import { slugify } from "@/lib/format";

/** Extensions we'd actually try to parse as data. Everything else is context. */
const SHEET_EXT = /\.(xlsx|xlsm|xls|csv|tsv|numbers)$/i;
const MAX_FILE_BYTES = 50 * 1024 * 1024;

export type IntakeDraft = { id: string; token: string };

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function validDraftToken(
  draft: IntakeDraft,
  allowedStatuses: Array<"draft" | "submitted">,
) {
  const { data } = await supabaseAdmin()
    .from("intake_upload_drafts")
    .select("id, cleanup_token_hash, status")
    .eq("id", draft.id)
    .maybeSingle();
  if (!data || !allowedStatuses.includes(data.status)) return false;
  const expected = Buffer.from(data.cleanup_token_hash);
  const actual = Buffer.from(tokenHash(draft.token));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

async function validDraft(draft: IntakeDraft) {
  return validDraftToken(draft, ["draft"]);
}

async function touchDraft(id: string) {
  await supabaseAdmin()
    .from("intake_upload_drafts")
    .update({ last_active_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "draft");
}

export async function createIntakeDraft(): Promise<
  { ok: true; draft: IntakeDraft } | { ok: false; error: string }
> {
  try {
    const token = randomBytes(32).toString("hex");
    const { data, error } = await supabaseAdmin()
      .from("intake_upload_drafts")
      .insert({ cleanup_token_hash: tokenHash(token) })
      .select("id")
      .single();
    if (error || !data) {
      return { ok: false, error: "We couldn't prepare the upload. Try again." };
    }
    return { ok: true, draft: { id: data.id, token } };
  } catch (error) {
    console.error("createIntakeDraft failed", error);
    return { ok: false, error: "Storage is not configured yet." };
  }
}

export async function heartbeatIntakeDraft(draft: IntakeDraft) {
  if (!(await validDraft(draft))) return { ok: false as const };
  await touchDraft(draft.id);
  return { ok: true as const };
}

/**
 * Hands the browser a one-time signed URL so files go straight to Supabase
 * Storage. Uploading through a server action instead would cap each file at
 * Vercel's ~4.5 MB request body limit, and phone photos blow past that
 * routinely.
 *
 * Called once per file, so a customer sending a zip of sheets plus four
 * whiteboard photos gets four independent uploads that can fail independently.
 */
export async function createUploadTarget(input: {
  draft: IntakeDraft;
  fileName: string;
  fileSize: number;
  mimeType?: string;
}): Promise<
  | { ok: true; id: string; path: string; token: string }
  | { ok: false; error: string }
> {
  if (!(await validDraft(input.draft))) {
    return { ok: false, error: "This upload session expired. Refresh and try again." };
  }
  if (
    !Number.isFinite(input.fileSize) ||
    input.fileSize < 0 ||
    input.fileSize > MAX_FILE_BYTES
  ) {
    return { ok: false, error: "Files must be smaller than 50 MB." };
  }

  const clean =
    input.fileName
      .normalize("NFKD")
      .replace(/[^\w.-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(-110) || "upload";
  const id = crypto.randomUUID();
  const path = `${input.draft.id}/${id}-${clean}`;

  try {
    const admin = supabaseAdmin();
    const { error: draftFileError } = await admin
      .from("intake_draft_files")
      .insert({
        id,
        draft_id: input.draft.id,
        path,
        file_name: input.fileName.slice(0, 200),
        file_size: Math.round(input.fileSize),
        mime_type: input.mimeType || null,
        state: "waiting",
      });
    if (draftFileError) {
      return { ok: false, error: "We couldn't prepare that file. Try it again." };
    }

    const { data, error } = await admin
      .storage.from("intake")
      .createSignedUploadUrl(path);
    if (error || !data) {
      await admin.from("intake_draft_files").delete().eq("id", id);
      return { ok: false, error: error?.message ?? "Could not start the upload." };
    }
    await touchDraft(input.draft.id);
    return {
      ok: true,
      id,
      path: data.path,
      token: data.token,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Storage is not configured yet.",
    };
  }
}

export type UploadedFile = {
  id: string;
  path: string;
  fileName: string;
  fileSize: number;
  mimeType?: string;
};

export async function completeDraftUpload(input: {
  draft: IntakeDraft;
  id: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await validDraft(input.draft))) {
    return { ok: false, error: "This upload session expired." };
  }
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("intake_draft_files")
    .update({ state: "uploaded", updated_at: new Date().toISOString() })
    .eq("id", input.id)
    .eq("draft_id", input.draft.id)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    return { ok: false, error: "The file arrived but could not be confirmed." };
  }
  await touchDraft(input.draft.id);
  return { ok: true };
}

export async function removeDraftUpload(input: {
  draft: IntakeDraft;
  id: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await validDraft(input.draft))) {
    return { ok: false, error: "This upload session expired." };
  }
  const admin = supabaseAdmin();
  const { data } = await admin
    .from("intake_draft_files")
    .select("path")
    .eq("id", input.id)
    .eq("draft_id", input.draft.id)
    .maybeSingle();
  if (!data) return { ok: true };
  const { error: storageError } = await admin.storage.from("intake").remove([data.path]);
  if (storageError && !/not found/i.test(storageError.message)) {
    return { ok: false, error: "The uploaded file could not be removed. Try again." };
  }
  await admin
    .from("intake_draft_files")
    .delete()
    .eq("id", input.id)
    .eq("draft_id", input.draft.id);
  await touchDraft(input.draft.id);
  return { ok: true };
}

export type IntakeResult =
  | {
      ok: true;
      workOrder: string;
      fileNames: string[];
      requestCount: number;
      name: string;
      companyName: string | null;
      email: string;
      byEmail: boolean;
    }
  | { ok: false; error: string };

/**
 * Records the submission, its attachments, and every capability the customer
 * asked for, then fires the "got your spreadsheet" email. Files are already in
 * storage by this point - this writes the paperwork.
 */
export async function submitIntake(input: {
  companyName: string;
  workOrderRef: string;
  name: string;
  email: string;
  draft: IntakeDraft;
  /** Ticked pick-list capability ids. */
  capabilities: string[];
  /** Answers to the two prompts, plus anything they typed freely. */
  answers: Record<string, string>;
  byEmail?: boolean;
}): Promise<IntakeResult> {
  const name = input.name.trim();
  const companyName = input.companyName.trim();
  const email = input.email.trim().toLowerCase();

  if (!name) {
    return { ok: false, error: "Add your name so we know who to write back to." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return { ok: false, error: "That email doesn't look right - check it?" };
  }
  if (!(await validDraft(input.draft))) {
    if (await validDraftToken(input.draft, ["submitted"])) {
      const existing = await existingDraftResult(input.draft.id, {
        name,
        email,
        companyName: companyName || null,
        byEmail: Boolean(input.byEmail),
      });
      if (existing) return existing;
    }
    return { ok: false, error: "This upload session expired. Refresh and try again." };
  }

  const admin = supabaseAdmin();
  const { data: draftFiles, error: draftFilesError } = await admin
    .from("intake_draft_files")
    .select("id, path, file_name, file_size, mime_type, state, created_at")
    .eq("draft_id", input.draft.id)
    .order("created_at");
  if (draftFilesError) {
    return { ok: false, error: "We couldn't confirm the uploaded files. Try again." };
  }
  if ((draftFiles ?? []).some((file) => file.state !== "uploaded")) {
    return { ok: false, error: "Wait for every file to finish uploading, then try again." };
  }
  const files: UploadedFile[] = (draftFiles ?? []).map((file) => ({
    id: file.id,
    path: file.path,
    fileName: file.file_name,
    fileSize: Number(file.file_size),
    mimeType: file.mime_type ?? undefined,
  }));

  if (files.length === 0 && !input.byEmail) {
    return {
      ok: false,
      error: "Attach at least one file, or choose to send it by email instead.",
    };
  }
  const requiredAnswers = ["main_job", "what_wastes_time"];
  if (requiredAnswers.some((id) => !input.answers?.[id]?.trim())) {
    return {
      ok: false,
      error: "Answer the two required workflow questions so we know what to build.",
    };
  }
  if (
    input.capabilities?.includes("something_else") &&
    !input.answers?.something_else?.trim()
  ) {
    return {
      ok: false,
      error: "Describe the extra capability you selected.",
    };
  }

  const answerCatalog = [
    ...INTAKE_PROMPTS,
    {
      id: "something_else",
      label: "Something else the app should handle",
      placeholder: "",
    },
  ];
  const intakeAnswers = Object.fromEntries(
    answerCatalog
      .map((prompt) => [
        prompt.id,
        { label: prompt.label, answer: input.answers?.[prompt.id]?.trim() ?? "" },
      ])
      .filter(([, value]) => (value as { answer: string }).answer),
  ) as Record<string, { label: string; answer: string }>;
  const workOrder =
    /^CL-[A-Z0-9]{8,20}$/.test(input.workOrderRef.toUpperCase())
      ? input.workOrderRef.toUpperCase()
      : `CL-${crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`;

  try {
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
        company_name: companyName || null,
        upload_draft_id: input.draft.id,
        work_order: workOrder,
        intake_answers: intakeAnswers,
        notes: Object.values(intakeAnswers)
          .map((value) => `${value.label}: ${value.answer}`)
          .join("\n\n")
          .slice(0, 4000),
        by_email: files.length === 0,
        status: "queued",
      })
      .select("id, created_at")
      .single();

    if (error || !submission) {
      const existing = await existingDraftResult(input.draft.id, {
        name,
        email,
        companyName: companyName || null,
        byEmail: Boolean(input.byEmail),
      });
      if (existing) return existing;
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
        await admin.from("intake_submissions").delete().eq("id", submission.id);
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
    const requests: {
      capability: string | null;
      body: string;
      prompt_id: string | null;
      prompt_label: string | null;
    }[] = [];
    for (const id of input.capabilities ?? []) {
      const cap = capabilityById(id);
      if (cap && cap.id !== "something_else") {
        requests.push({
          capability: cap.id,
          body: cap.label,
          prompt_id: null,
          prompt_label: null,
        });
      }
    }
    for (const [promptId, value] of Object.entries(intakeAnswers)) {
      requests.push({
        capability: null,
        body: value.answer.slice(0, 2000),
        prompt_id: promptId,
        prompt_label: value.label,
      });
    }

    if (requests.length > 0) {
      const { error: requestsError } = await admin.from("intake_requests").insert(
        requests.map((r) => ({
          submission_id: submission.id,
          capability: r.capability,
          body: r.body,
          prompt_id: r.prompt_id,
          prompt_label: r.prompt_label,
        })),
      );
      if (requestsError) {
        await admin.from("intake_submissions").delete().eq("id", submission.id);
        return {
          ok: false,
          error: "The files arrived, but the brief did not save. Try sending it again.",
        };
      }
    }

    await admin
      .from("intake_upload_drafts")
      .update({
        status: "submitted",
        submission_id: submission.id,
        submitted_at: new Date().toISOString(),
        last_active_at: new Date().toISOString(),
      })
      .eq("id", input.draft.id)
      .eq("status", "draft");
    await sendEmail(
      receivedEmail({
        name,
        fileName: files[primaryIndex]?.fileName ?? null,
        fileCount: files.length,
        requestCount: requests.length,
        workOrder,
        needsFiles: Boolean(input.byEmail),
      }),
      email,
    );

    return {
      ok: true,
      workOrder,
      companyName: companyName || null,
      fileNames: files.map((f) => f.fileName),
      requestCount: requests.length,
      name,
      email,
      byEmail: Boolean(input.byEmail),
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

async function existingDraftResult(
  draftId: string,
  fallback: {
    name: string;
    email: string;
    companyName: string | null;
    byEmail: boolean;
  },
): Promise<Extract<IntakeResult, { ok: true }> | null> {
  const admin = supabaseAdmin();
  const { data: submission } = await admin
    .from("intake_submissions")
    .select("id, work_order, name, email, company_name, by_email")
    .eq("upload_draft_id", draftId)
    .maybeSingle();
  if (!submission) return null;
  const [{ data: files }, { count }] = await Promise.all([
    admin
      .from("intake_attachments")
      .select("file_name")
      .eq("submission_id", submission.id)
      .order("position"),
    admin
      .from("intake_requests")
      .select("id", { count: "exact", head: true })
      .eq("submission_id", submission.id),
  ]);
  return {
    ok: true,
    workOrder: submission.work_order ?? "CREWLOG",
    fileNames: (files ?? []).map((file) => file.file_name),
    requestCount: count ?? 0,
    name: submission.name ?? fallback.name,
    companyName: submission.company_name ?? fallback.companyName,
    email: submission.email ?? fallback.email,
    byEmail: Boolean(submission.by_email ?? fallback.byEmail),
  };
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
