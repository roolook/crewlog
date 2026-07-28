import { supabaseAdmin } from "@/lib/supabase/admin";
import { sampleEmails } from "@/lib/email/templates";
import { c, f } from "@/lib/theme";
import { relative } from "@/lib/format";

export const dynamic = "force-dynamic";

const LABELS: Record<string, string> = {
  received: "1 / RECEIVED",
  preview_ready: "2 / PREVIEW READY — the conversion email",
  magic_link: "3 / MAGIC LINK",
  crew_invite: "4 / CREW INVITE",
  activation_receipt: "5 / ACTIVATION RECEIPT",
};

/**
 * Two things on one page: the five templates as they'll render, and the log of
 * what actually went out. With EMAIL_PROVIDER=log, this *is* the outbox.
 */
export default async function OpsEmailsPage() {
  const { data: sent } = await supabaseAdmin()
    .from("email_log")
    .select("id, template, to_email, subject, provider, error, created_at")
    .order("created_at", { ascending: false })
    .limit(40);

  const failures = (sent ?? []).filter((r) => r.error);
  const provider = (process.env.EMAIL_PROVIDER ?? "log").toLowerCase();
  const templates = sampleEmails();
  const testInbox = process.env.EMAIL_TEST_INBOX?.trim();
  const sandbox = (process.env.EMAIL_FROM_BUILD ?? "").includes("resend.dev");
  const noKey = provider === "resend" && !process.env.RESEND_API_KEY;

  const status = noKey
    ? "EMAIL_PROVIDER=resend but RESEND_API_KEY is empty — nothing will send."
    : provider !== "resend"
      ? "rendered and logged, not delivered. Set EMAIL_PROVIDER=resend to send."
      : sandbox && testInbox
        ? `sandbox sender — every email is redirected to ${testInbox}, with the real recipient in the subject line.`
        : sandbox
          ? "sandbox sender — can only reach your own Resend account address; anyone else 403s. Set EMAIL_TEST_INBOX to route everything to you."
          : "delivering to real recipients.";

  return (
    <div>
      <h1
        style={{
          fontFamily: f.display,
          fontWeight: 900,
          fontSize: 24,
          margin: "0 0 4px",
        }}
      >
        Emails
      </h1>
      <div
        style={{
          fontFamily: f.mono,
          fontSize: 12,
          color: noKey ? c.red : c.muted,
          marginBottom: 24,
          maxWidth: "68em",
          lineHeight: 1.5,
        }}
      >
        provider: {provider} — {status}
      </div>

      {/* Failures carry the actionable message — the sandbox 403 in particular
          reads like a bad API key unless it's spelled out. */}
      {failures.length > 0 && (
        <div
          style={{
            background: "#FDECEA",
            border: `1px solid ${c.red}`,
            borderRadius: 4,
            padding: "14px 16px",
            marginBottom: 24,
            maxWidth: "68em",
          }}
        >
          <div
            style={{
              fontFamily: f.mono,
              fontSize: 11,
              letterSpacing: "0.1em",
              color: c.red,
              marginBottom: 8,
            }}
          >
            {failures.length} RECENT FAILURE{failures.length === 1 ? "" : "S"}
          </div>
          {failures.slice(0, 4).map((row) => (
            <div
              key={row.id}
              style={{
                fontSize: 13,
                color: c.body,
                lineHeight: 1.5,
                marginBottom: 6,
              }}
            >
              <span style={{ fontFamily: f.mono, fontSize: 12 }}>
                {row.template} → {row.to_email}
              </span>
              <br />
              {row.error}
            </div>
          ))}
        </div>
      )}

      {/* ── outbox ── */}
      <div
        style={{
          fontFamily: f.mono,
          fontSize: 11,
          letterSpacing: "0.12em",
          color: c.muted,
          marginBottom: 10,
        }}
      >
        LAST {sent?.length ?? 0} SENT
      </div>
      <div
        style={{
          background: c.paper,
          border: `1px solid ${c.line}`,
          borderRadius: 4,
          overflowX: "auto",
          marginBottom: 40,
        }}
      >
        <div style={{ minWidth: 760 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1.3fr 2fr 0.7fr 0.7fr",
              fontFamily: f.mono,
              fontSize: 11,
              color: c.muted,
              borderBottom: `2px solid ${c.ink}`,
              background: c.paperAlt,
            }}
          >
            {["TEMPLATE", "TO", "SUBJECT", "WHEN", "STATUS"].map((h) => (
              <div key={h} style={{ padding: "9px 12px" }}>
                {h}
              </div>
            ))}
          </div>
          {(sent ?? []).map((row) => (
            <div
              key={row.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1.3fr 2fr 0.7fr 0.7fr",
                fontSize: 12,
                borderBottom: `1px solid ${c.lineFaint}`,
                alignItems: "center",
              }}
            >
              <div style={{ padding: "10px 12px", fontFamily: f.mono }}>
                {row.template}
              </div>
              <div
                style={{
                  padding: "10px 12px",
                  fontFamily: f.mono,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {row.to_email}
              </div>
              <div
                style={{
                  padding: "10px 12px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {row.subject}
              </div>
              <div style={{ padding: "10px 12px", color: c.muted }}>
                {relative(row.created_at)}
              </div>
              <div
                style={{
                  padding: "10px 12px",
                  fontFamily: f.mono,
                  fontSize: 11,
                  color: row.error ? c.red : c.green,
                }}
                title={row.error ?? ""}
              >
                {row.error ? "failed" : row.provider === "log" ? "logged" : "sent"}
              </div>
            </div>
          ))}
          {(sent ?? []).length === 0 && (
            <div style={{ padding: "30px 14px", color: c.muted, fontSize: 14 }}>
              Nothing sent yet.
            </div>
          )}
        </div>
      </div>

      {/* ── templates ── */}
      <div
        style={{
          fontFamily: f.mono,
          fontSize: 11,
          letterSpacing: "0.12em",
          color: c.muted,
          marginBottom: 10,
        }}
      >
        THE FIVE TEMPLATES
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 28 }}>
        {templates.map((t) => (
          <div key={t.template} style={{ flex: "0 1 420px" }}>
            <div
              style={{
                fontFamily: f.mono,
                fontSize: 12,
                color: c.muted,
                marginBottom: 8,
              }}
            >
              {LABELS[t.template] ?? t.template}
            </div>
            <div
              style={{
                background: c.paper,
                border: `1px solid ${c.line}`,
                borderRadius: 4,
                overflow: "hidden",
              }}
            >
              <div
                style={{ padding: "14px 20px", borderBottom: `1px solid ${c.lineFaint}` }}
              >
                <div style={{ fontFamily: f.mono, fontSize: 11, color: c.muted }}>
                  from: {t.from}
                </div>
                <div style={{ fontWeight: 700, fontSize: 16, marginTop: 4 }}>
                  {t.subject}
                </div>
              </div>
              <iframe
                srcDoc={t.html}
                title={`${t.template} preview`}
                sandbox=""
                style={{
                  display: "block",
                  width: "100%",
                  height: 380,
                  border: "none",
                  background: c.band,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
