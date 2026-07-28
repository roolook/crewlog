"use server";

import { revalidatePath } from "next/cache";
import { requireOperator } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function setChangeDone(id: string, done: boolean) {
  await requireOperator();
  const { error } = await supabaseAdmin()
    .from("change_requests")
    .update({ done, done_at: done ? new Date().toISOString() : null })
    .eq("id", id);

  revalidatePath("/ops/changes");
  return { ok: !error };
}
