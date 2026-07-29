import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const GRACE_HOURS = 24;

function authorized(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || !supplied) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = supabaseAdmin();
  const cutoff = new Date(Date.now() - GRACE_HOURS * 60 * 60 * 1000).toISOString();
  const { data: drafts, error } = await admin
    .from("intake_upload_drafts")
    .select("id")
    .eq("status", "draft")
    .lt("last_active_at", cutoff)
    .limit(200);

  if (error) {
    console.error("Intake draft cleanup lookup failed", error);
    return NextResponse.json({ error: "Cleanup lookup failed" }, { status: 500 });
  }

  let removedDrafts = 0;
  let removedFiles = 0;
  for (const draft of drafts ?? []) {
    const { data: files } = await admin
      .from("intake_draft_files")
      .select("path")
      .eq("draft_id", draft.id);
    const paths = (files ?? []).map((file) => file.path);
    if (paths.length) {
      const { error: storageError } = await admin.storage.from("intake").remove(paths);
      if (storageError) {
        console.error("Intake draft storage cleanup failed", {
          draftId: draft.id,
          message: storageError.message,
        });
        continue;
      }
      removedFiles += paths.length;
    }
    const { error: deleteError } = await admin
      .from("intake_upload_drafts")
      .delete()
      .eq("id", draft.id)
      .eq("status", "draft");
    if (!deleteError) removedDrafts += 1;
  }

  return NextResponse.json({ ok: true, removedDrafts, removedFiles });
}
