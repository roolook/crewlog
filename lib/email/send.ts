import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { RenderedEmail } from "@/lib/email/templates";

/**
 * Sends a rendered email and records it in `email_log` either way.
 *
 * Three modes, set by EMAIL_PROVIDER:
 *
 *   log     — render and store only. Nothing leaves the building; /ops/emails
 *             is the outbox. The default, and enough to walk the whole funnel.
 *   resend  — deliver through Resend.
 *   (unset) — same as `log`.
 *
 * ── The resend.dev sandbox ────────────────────────────────────────────────
 * Resend's shared `onboarding@resend.dev` sender needs no DNS setup, but it can
 * only deliver to the address on your Resend account — every other recipient is
 * rejected with a 403. That makes it a test harness rather than a mail service.
 *
 * So when EMAIL_TEST_INBOX is set, every message is redirected there with the
 * real recipient preserved in the subject and called out in a banner at the top
 * of the body. You receive the customer's "your app is ready" email exactly as
 * they would, and `email_log.to_email` still records who it was actually for.
 *
 * Delivery failures are logged, never thrown: a broken mail provider must not
 * take down an intake submission or an invite.
 */
export async function sendEmail(
  email: RenderedEmail,
  to: string,
  tenantId?: string | null,
): Promise<{ delivered: boolean; redirected?: string; error?: string }> {
  const provider = (process.env.EMAIL_PROVIDER ?? "log").toLowerCase();
  const testInbox = process.env.EMAIL_TEST_INBOX?.trim().toLowerCase();
  const intended = to.trim().toLowerCase();

  // Redirect only when the real recipient isn't already the test inbox.
  const redirectTo =
    testInbox && testInbox !== intended ? testInbox : undefined;
  const envelopeTo = redirectTo ?? intended;

  let providerId: string | null = null;
  let error: string | null = null;

  if (provider === "resend") {
    if (!process.env.RESEND_API_KEY) {
      error = "EMAIL_PROVIDER=resend but RESEND_API_KEY is not set.";
    } else {
      const subject = redirectTo
        ? `[→ ${intended}] ${email.subject}`
        : email.subject;

      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: email.from,
            to: [envelopeTo],
            reply_to: email.replyTo,
            subject,
            html: redirectTo
              ? withRedirectBanner(email.html, intended, email.from)
              : email.html,
            text: redirectTo
              ? `[This is a test copy. The real recipient would be ${intended}.]\n\n${email.text}`
              : email.text,
          }),
        });

        const json = (await res.json().catch(() => ({}))) as {
          id?: string;
          message?: string;
          name?: string;
        };

        if (!res.ok) {
          error = explainResendError(res.status, json, envelopeTo, email.from);
        } else {
          providerId = json.id ?? null;
        }
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
      }
    }
  }

  try {
    await supabaseAdmin()
      .from("email_log")
      .insert({
        template: email.template,
        // Always the intended recipient, so the log stays a true record even
        // when delivery was redirected to the test inbox.
        to_email: intended,
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

  if (error) console.error(`email ${email.template} → ${intended} failed:`, error);

  return {
    delivered: !error,
    redirected: error ? undefined : redirectTo,
    error: error ?? undefined,
  };
}

/**
 * Turns Resend's terser failures into something actionable. The sandbox 403 is
 * the one people hit first and it's easy to misread as a bad key.
 */
function explainResendError(
  status: number,
  json: { message?: string; name?: string },
  envelopeTo: string,
  from: string,
): string {
  const detail = json.message ?? json.name ?? `HTTP ${status}`;

  if (status === 403 && /own email address|testing emails/i.test(detail)) {
    return (
      `Resend refused ${envelopeTo}: the shared ${from} sender can only ` +
      `deliver to the address on your Resend account. Set EMAIL_TEST_INBOX to ` +
      `that address to route all mail there, or verify a domain to email real ` +
      `customers. (${detail})`
    );
  }
  if (status === 401 || status === 403) {
    return `Resend rejected the API key (${detail}).`;
  }
  if (status === 422 && /from/i.test(detail)) {
    return (
      `Resend rejected the from address ${from} — the domain isn't verified. ` +
      `Use onboarding@resend.dev for testing, or verify your domain. (${detail})`
    );
  }
  if (status === 429) return `Resend rate limit hit (${detail}).`;
  return detail;
}

/** A plain banner making clear this is a redirected test copy. */
function withRedirectBanner(html: string, intended: string, from: string) {
  const banner =
    `<div style="margin:0 0 16px;padding:10px 14px;background:#FDEDE5;` +
    `border:1px solid #D8430F;border-radius:4px;font:13px/1.5 ` +
    `-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;` +
    `color:#17181B;">` +
    `<strong>Test copy.</strong> This would have gone to ` +
    `<strong>${escapeAttr(intended)}</strong>. It came here instead because ` +
    `<code>${escapeAttr(from)}</code> can only deliver to your own Resend ` +
    `account address. Verify a domain to send to real customers.` +
    `</div>`;

  // Slot the banner just inside <body> so it sits above the email's own shell.
  return html.includes("<body")
    ? html.replace(/(<body[^>]*>)/i, `$1${banner}`)
    : banner + html;
}

function escapeAttr(s: string) {
  return s.replace(
    /[&<>"']/g,
    (ch) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        ch
      ]!,
  );
}
