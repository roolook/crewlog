"use server";

import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function safeValue(form: FormData, key: string, max: number) {
  return String(form.get(key) ?? "").trim().slice(0, max);
}

export async function submitChangeRequest(form: FormData) {
  const name = safeValue(form, "name", 120);
  const email = safeValue(form, "email", 320).toLowerCase();
  const body = safeValue(form, "body", 3000);
  const tenantSlug = safeValue(form, "tenant", 100);
  const previewToken = safeValue(form, "preview", 100);
  const source = safeValue(form, "source", 30);
  const honey = safeValue(form, "website", 200);
  const returnQuery = new URLSearchParams();
  if (tenantSlug) returnQuery.set("tenant", tenantSlug);
  if (previewToken) returnQuery.set("preview", previewToken);
  if (source) returnQuery.set("source", source);

  if (honey) redirect(`/request-change?${returnQuery.toString()}`);
  if (!name || !EMAIL_RE.test(email) || body.length < 5) {
    returnQuery.set("error", "details");
    redirect(`/request-change?${returnQuery.toString()}`);
  }

  let tenantId: string | null = null;
  const admin = supabaseAdmin();
  if (tenantSlug) {
    const { data: tenant } = await admin
      .from("tenants")
      .select("id, preview_token, preview_expires_at")
      .eq("slug", tenantSlug)
      .maybeSingle();
    if (!tenant) {
      returnQuery.set("error", "app");
      redirect(`/request-change?${returnQuery.toString()}`);
    }
    tenantId = tenant.id;

    const supabase = await supabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { error } = await supabase.from("change_requests").insert({
        tenant_id: tenantId,
        requester: name,
        requester_email: email,
        body,
      });
      if (!error) {
        returnQuery.set("sent", "1");
        redirect(`/request-change?${returnQuery.toString()}`);
      }
    }

    const previewValid =
      UUID_RE.test(previewToken) &&
      previewToken === tenant.preview_token &&
      (!tenant.preview_expires_at ||
        new Date(tenant.preview_expires_at).getTime() > Date.now());
    if (!previewValid) {
      returnQuery.set("error", "access");
      redirect(`/request-change?${returnQuery.toString()}`);
    }
  } else if (source !== "demo") {
    returnQuery.set("error", "app");
    redirect(`/request-change?${returnQuery.toString()}`);
  }

  const { error } = await admin.from("change_requests").insert({
    tenant_id: tenantId,
    requester: name,
    requester_email: email,
    body,
  });
  if (error) {
    console.error("Change request insert failed", {
      tenantId,
      message: error.message,
    });
    returnQuery.set("error", "save");
  } else {
    returnQuery.set("sent", "1");
  }
  redirect(`/request-change?${returnQuery.toString()}`);
}
