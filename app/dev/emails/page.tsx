import { notFound } from "next/navigation";
import { sampleEmails } from "@/lib/email/templates";
import { c, f } from "@/lib/theme";

/**
 * Dev-only email gallery. The ops console has the real one at /ops/emails, but
 * that needs a database and an operator login; this renders the five templates
 * from nothing so they can be checked while iterating on them.
 *
 * 404s outside development so it never ships.
 */
export const metadata = { title: "CrewLog — email templates (dev)", robots: { index: false } };

const LABELS: Record<string, string> = {
  received: "1 / RECEIVED",
  preview_ready: "2 / PREVIEW READY — the conversion email",
  magic_link: "3 / MAGIC LINK",
  crew_invite: "4 / CREW INVITE",
  activation_receipt: "5 / ACTIVATION RECEIPT",
};

export default function DevEmailsPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const templates = sampleEmails();

  return (
    <main style={{ maxWidth: 1400, margin: "0 auto", padding: "40px 24px 80px" }}>
      <div
        style={{
          fontFamily: f.mono,
          fontSize: 13,
          letterSpacing: "0.12em",
          color: c.muted,
        }}
      >
        CREWLOG · THE 5 EMAILS
      </div>
      <div style={{ fontSize: 15, color: c.body, margin: "6px 0 28px" }}>
        Plain, text-forward, human-sent. Light HTML, no marketing chrome.{" "}
        <span style={{ fontFamily: f.mono, fontSize: 12, color: c.muted }}>
          (dev only — the real outbox is /ops/emails)
        </span>
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
              {/* Mail-client chrome, drawn here rather than baked into the body */}
              <div
                style={{
                  padding: "14px 20px",
                  borderBottom: `1px solid ${c.lineFaint}`,
                }}
              >
                <div style={{ fontFamily: f.mono, fontSize: 11, color: c.muted }}>
                  from: {t.from}
                </div>
                <div style={{ fontFamily: f.mono, fontSize: 11, color: c.muted }}>
                  reply-to: {t.replyTo}
                </div>
                <div style={{ fontWeight: 700, fontSize: 15.5, marginTop: 4 }}>
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
                  height: 420,
                  border: "none",
                  background: c.band,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
