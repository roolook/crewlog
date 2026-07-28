import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { activationReceiptEmail } from "@/lib/email/templates";

/**
 * Stripe webhook - the other half of the payment-link flow.
 *
 * Unwired by default: with STRIPE_PAYMENT_LINK unset, /preview activates
 * directly and this endpoint is never reached. To go live:
 *   1. create a Payment Link for the monthly subscription only and put
 *      it in STRIPE_PAYMENT_LINK
 *   2. add this URL as a webhook endpoint for `checkout.session.completed`
 *   3. set STRIPE_WEBHOOK_SECRET to the endpoint's signing secret
 *
 * Signatures are verified here with Web Crypto rather than the Stripe SDK, so
 * there's no extra dependency on the untrusted-input path. Without a configured
 * secret the endpoint refuses outright - nobody flips a tenant to active by
 * POSTing at it.
 */

/** Reject replayed events older than this. Stripe's own default. */
const TOLERANCE_SECONDS = 300;

export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const header = request.headers.get("stripe-signature");

  if (!secret) {
    return NextResponse.json(
      { error: "Stripe is not configured on this deployment." },
      { status: 501 },
    );
  }
  if (!header) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  // Must be the raw body, byte for byte - the signature covers exactly this.
  const raw = await request.text();

  const verified = await verifyStripeSignature(raw, header, secret);
  if (!verified.ok) {
    return NextResponse.json({ error: verified.error }, { status: 400 });
  }

  let event: { type?: string; data?: { object?: Record<string, unknown> } };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Malformed payload." }, { status: 400 });
  }

  const object = event.data?.object ?? {};
  const admin = supabaseAdmin();

  if (event.type === "customer.subscription.updated") {
    const subscriptionId = String(object.id ?? "");
    const status = stripeBillingStatus(String(object.status ?? ""));
    if (subscriptionId && status) {
      await admin
        .from("tenants")
        .update({
          billing_status: status,
          current_period_start: unixDate(object.current_period_start),
          current_period_end: unixDate(object.current_period_end),
        })
        .eq("stripe_subscription_id", subscriptionId);
    }
    return NextResponse.json({ received: true });
  }

  if (event.type === "customer.subscription.deleted") {
    const subscriptionId = String(object.id ?? "");
    if (subscriptionId) {
      await admin
        .from("tenants")
        .update({ billing_status: "canceled" })
        .eq("stripe_subscription_id", subscriptionId);
    }
    return NextResponse.json({ received: true });
  }

  if (event.type === "invoice.payment_failed" || event.type === "invoice.paid") {
    const subscriptionId = String(object.subscription ?? "");
    if (subscriptionId) {
      await admin
        .from("tenants")
        .update({
          billing_status:
            event.type === "invoice.paid" ? "active" : "past_due",
        })
        .eq("stripe_subscription_id", subscriptionId);
    }
    return NextResponse.json({ received: true });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  // Set by /preview when it builds the payment link.
  const tenantId = String(object.client_reference_id ?? "");
  if (!isUuid(tenantId)) return NextResponse.json({ received: true });

  const { data: tenant } = await admin
    .from("tenants")
    .select("id, name, owner_email, owner_name, status")
    .eq("id", tenantId)
    .maybeSingle();

  // Idempotent: Stripe retries, and we must not send two receipts.
  if (!tenant || tenant.status === "active") {
    return NextResponse.json({ received: true });
  }

  await admin
    .from("tenants")
    .update({
      status: "active",
      billing_status: "active",
      stripe_customer_id: String(object.customer ?? "") || null,
      stripe_subscription_id: String(object.subscription ?? "") || null,
      current_period_start: new Date().toISOString(),
      activated_at: new Date().toISOString(),
    })
    .eq("id", tenant.id);

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

  return NextResponse.json({ received: true });
}

/**
 * Verifies a `Stripe-Signature` header: `t=<unix>,v1=<hex hmac>`, where the
 * signed payload is `<t>.<raw body>` under HMAC-SHA256.
 */
async function verifyStripeSignature(
  body: string,
  header: string,
  secret: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parts = new Map(
    header.split(",").map((kv) => {
      const i = kv.indexOf("=");
      return [kv.slice(0, i).trim(), kv.slice(i + 1).trim()] as [string, string];
    }),
  );

  const timestamp = parts.get("t");
  // A header may carry several v1 signatures during secret rotation.
  const signatures = header
    .split(",")
    .filter((kv) => kv.trim().startsWith("v1="))
    .map((kv) => kv.trim().slice(3));

  if (!timestamp || signatures.length === 0) {
    return { ok: false, error: "Unparseable signature header." };
  }

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > TOLERANCE_SECONDS) {
    return { ok: false, error: "Signature timestamp outside tolerance." };
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${body}`),
  );
  const expected = [...new Uint8Array(mac)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const match = signatures.some((sig) => timingSafeEqual(sig, expected));
  return match ? { ok: true } : { ok: false, error: "Signature mismatch." };
}

/** Constant-time string compare, so a mismatch leaks no position information. */
function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

function stripeBillingStatus(
  status: string,
): "trialing" | "active" | "past_due" | "canceled" | null {
  if (status === "trialing" || status === "active" || status === "past_due") {
    return status;
  }
  if (status === "canceled" || status === "unpaid" || status === "incomplete_expired") {
    return "canceled";
  }
  return null;
}

function unixDate(value: unknown) {
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0
    ? new Date(seconds * 1000).toISOString()
    : null;
}
