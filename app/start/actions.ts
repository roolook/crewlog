"use server";

import { createHash, timingSafeEqual } from "node:crypto";
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
  | { ok: true; path: string; token: string; cleanupToken: string }
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
    return {
      ok: true,
      path: data.path,
      token: data.token,
      cleanupToken: cleanupToken(data.path),
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Storage is not configured yet.",
    };
  }
}

export type UploadedFile = {
  path: string;
  cleanupToken: string;
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
      companyName: string;
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
  files: UploadedFile[];
  /** Ticked pick-list capability ids. */
  capabilities: string[];
  /** Answers to the two prompts, plus anything they typed freely. */
  answers: Record<string, string>;
  byEmail?: boolean;
}): Promise<IntakeResult> {
  const name = input.name.trim();
  const companyName = input.companyName.trim();
  const email = input.email.trim().toLowerCase();
  const files = input.files ?? [];

  if (!companyName) {
    return { ok: false, error: "Add the company name so we build the right app." };
  }
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
  const requiredAnswers = ["who_uses_it", "main_job", "what_wastes_time"];
  if (requiredAnswers.some((id) => !input.answers?.[id]?.trim())) {
    return {
      ok: false,
      error: "Answer the three workflow questions so we know what to build.",
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

  let submissionRecorded = false;
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
        company_name: companyName,
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
      await removeUploads(files);
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
        await removeUploads(files);
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
        await removeUploads(files);
        return {
          ok: false,
          error: "The files arrived, but the brief did not save. Try sending it again.",
        };
      }
    }

    submissionRecorded = true;
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
      companyName,
      fileNames: files.map((f) => f.fileName),
      requestCount: requests.length,
      name,
      email,
      byEmail: Boolean(input.byEmail),
    };
  } catch (e) {
    console.error("submitIntake failed", e);
    if (!submissionRecorded) await removeUploads(files);
    return {
      ok: false,
      error:
        "Something broke on our end. Email build@crewlog.app - that always works.",
    };
  }
}

export async function cleanupUploadedFiles(files: UploadedFile[]) {
  await removeUploads(files);
}

async function removeUploads(files: UploadedFile[]) {
  const paths = files
    .filter((file) => validCleanupToken(file.path, file.cleanupToken))
    .map((file) => file.path);
  if (paths.length) await supabaseAdmin().storage.from("intake").remove(paths);
}

function cleanupToken(path: string) {
  return createHash("sha256")
    .update(`${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""}:${path}`)
    .digest("hex");
}

function validCleanupToken(path: string, token: string) {
  const expected = Buffer.from(cleanupToken(path));
  const actual = Buffer.from(token ?? "");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
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
