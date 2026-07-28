"use server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { activationReceiptEmail } from "@/lib/email/templates";

/**
 * Activation.
 *
 * With STRIPE_PAYMENT_LINK set, the button sends the customer to Stripe and the
 * tenant flips to active from the webhook (see app/api/stripe/route.ts). With it
 * unset — the default — this marks the tenant active directly and emails the
 * receipt, so the whole funnel is walkable end to end before any payment
 * account exists.
 *
 * The preview token is the authorisation: only someone holding the emailed link
 * can activate that tenant.
 */
export async function activateAction(
  slug: string,
  token: string,
): Promise<
  | { ok: true; mode: "redirect"; url: string }
  | { ok: true; mode: "activated" }
  | { ok: false; error: string }
> {
  const admin = supabaseAdmin();

  const { data: tenant } = await admin
    .from("tenants")
    .select("id, name, slug, status, owner_email, owner_name, preview_token")
    .eq("slug", slug)
    .maybeSingle();

  if (!tenant) return { ok: false, error: "That preview isn't available." };
  if (tenant.preview_token !== token) {
    return { ok: false, error: "That link isn't valid any more." };
  }
  if (tenant.status === "active") return { ok: true, mode: "activated" };

  const paymentLink = process.env.STRIPE_PAYMENT_LINK?.trim();
  if (paymentLink) {
    const url = new URL(paymentLink);
    // Prefill so the customer doesn't retype it, and carry the tenant through
    // to the webhook.
    if (tenant.owner_email) url.searchParams.set("prefilled_email", tenant.owner_email);
    url.searchParams.set("client_reference_id", tenant.id);
    return { ok: true, mode: "redirect", url: url.toString() };
  }

  const { error } = await admin
    .from("tenants")
    .update({ status: "active", activated_at: new Date().toISOString() })
    .eq("id", tenant.id);

  if (error) return { ok: false, error: "Could not activate — try again." };

  await admin
    .from("intake_submissions")
    .update({ status: "activated" })
    .eq("tenant_id", tenant.id);

  if (tenant.owner_email) {
    await sendEmail(
      activationReceiptEmail({
        name: tenant.owner_name ?? "there",
        tenantName: tenant.name,
      }),
      tenant.owner_email,
      tenant.id,
    );
  }

  return { ok: true, mode: "activated" };
}

/** Invite a first crew member straight from the activated preview. */
export async function previewInviteAction(
  slug: string,
  token: string,
  contact: string,
): Promise<{ ok: boolean; error?: string }> {
  const admin = supabaseAdmin();
  const value = contact.trim();
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);

  const { data: tenant } = await admin
    .from("tenants")
    .select("id, preview_token, status")
    .eq("slug", slug)
    .maybeSingle();

  if (!tenant || tenant.preview_token !== token) {
    return { ok: false, error: "That link isn't valid any more." };
  }
  if (!value) return { ok: false, error: "Add an email or phone number." };

  const { error } = await admin.from("tenant_members").insert({
    tenant_id: tenant.id,
    display_name: isEmail ? value.split("@")[0] : value,
    email: isEmail ? value.toLowerCase() : null,
    phone: isEmail ? null : value,
    role: "crew",
    status: "pending",
  });

  return error ? { ok: false, error: "Could not send that invite." } : { ok: true };
}
