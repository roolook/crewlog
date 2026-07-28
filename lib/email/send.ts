import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { RenderedEmail } from "@/lib/email/templates";

/**
 * Sends a rendered email and records it in `email_log` either way.
 *
 * With EMAIL_PROVIDER=log (the default) nothing leaves the building: the mail
 * is rendered, stored, and visible in the ops console at /ops/emails. Set
 * EMAIL_PROVIDER=resend and RESEND_API_KEY to deliver for real — no other code
 * changes needed.
 *
 * Delivery failures are logged, never thrown: a broken mail provider must not
 * take down an intake submission or an invite.
 */
export async function sendEmail(
  email: RenderedEmail,
  to: string,
  tenantId?: string | null,
): Promise<{ delivered: boolean; error?: string }> {
  const provider = (process.env.EMAIL_PROVIDER ?? "log").toLowerCase();
  let providerId: string | null = null;
  let error: string | null = null;

  if (provider === "resend" && process.env.RESEND_API_KEY) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: email.from,
          to: [to],
          subject: email.subject,
          html: email.html,
          text: email.text,
        }),
      });
      const json = (await res.json()) as { id?: string; message?: string };
      if (!res.ok) error = json.message ?? `resend returned ${res.status}`;
      else providerId = json.id ?? null;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }

  try {
    await supabaseAdmin()
      .from("email_log")
      .insert({
        template: email.template,
        to_email: to,
        from_email: email.from,
        subject: email.subject,
        html: email.html,
        text_body: email.text,
        tenant_id: tenantId ?? null,
        provider,
        provider_id: providerId,
        error,
      });
  } catch (e) {
    // The log table is best-effort; don't fail the caller over it.
    console.error("email_log insert failed", e);
  }

  if (error) console.error(`email ${email.template} → ${to} failed:`, error);
  return { delivered: !error, error: error ?? undefined };
}
