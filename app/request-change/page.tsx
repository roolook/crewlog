import Link from "next/link";
import { Brand } from "@/components/Brand";
import { c, f, shadow } from "@/lib/theme";
import { submitChangeRequest } from "./actions";

export const metadata = {
  title: "Request a change - CrewLog",
  robots: { index: false },
};

export default async function RequestChangePage({
  searchParams,
}: {
  searchParams: Promise<{
    tenant?: string;
    preview?: string;
    source?: string;
    sent?: string;
    error?: string;
  }>;
}) {
  const params = await searchParams;
  const backHref = params.tenant
    ? params.preview
      ? `/preview/${encodeURIComponent(params.tenant)}?t=${encodeURIComponent(
          params.preview,
        )}`
      : `/app/${encodeURIComponent(params.tenant)}`
    : "/demo";

  return (
    <div style={{ minHeight: "100dvh" }}>
      <header style={header}>
        <Brand />
        <Link href={backHref} style={{ color: c.muted }}>
          Back to the app
        </Link>
      </header>
      <main style={main}>
        <div style={eyebrow}>REQUEST A CHANGE</div>
        <h1 style={heading}>
          {params.sent ? "Your request is in." : "Tell us what should change."}
        </h1>
        {params.sent ? (
          <div style={card}>
            <p style={intro}>
              A person will review it and reply by email. Your app and data are
              unchanged until the update is ready.
            </p>
            <Link href={backHref} style={primaryLink}>
              Return to the app
            </Link>
          </div>
        ) : (
          <form action={submitChangeRequest} style={card}>
            <p style={intro}>
              Describe the result you need. Screens, calculations, workflow
              changes and integrations are all fine.
            </p>
            {params.error && (
              <div role="alert" style={errorCard}>
                {errorMessage(params.error)}
              </div>
            )}
            <input type="hidden" name="tenant" value={params.tenant ?? ""} />
            <input type="hidden" name="preview" value={params.preview ?? ""} />
            <input type="hidden" name="source" value={params.source ?? ""} />
            <label style={label}>
              YOUR NAME
              <input name="name" required autoComplete="name" style={input} />
            </label>
            <label style={label}>
              EMAIL
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                style={input}
              />
            </label>
            <label style={label}>
              WHAT SHOULD CHANGE?
              <textarea name="body" required minLength={5} rows={7} style={textarea} />
            </label>
            <label style={honeypot} aria-hidden="true">
              Website
              <input name="website" tabIndex={-1} autoComplete="off" />
            </label>
            <button type="submit" className="cl-btn-orange" style={button}>
              Send change request
            </button>
            <p style={fallback}>
              If this form cannot send, email{" "}
              <a href="mailto:build@crewlog.app">build@crewlog.app</a>.
            </p>
          </form>
        )}
      </main>
    </div>
  );
}

function errorMessage(error: string) {
  if (error === "details") return "Add your name, a complete email and a short description.";
  if (error === "access") return "Open this form from your signed-in app or preview link.";
  if (error === "app") return "We could not identify the app for this request.";
  return "The request did not save. Try again or use the email address below.";
}

const header: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
  padding: "14px 20px",
  borderBottom: `1px solid ${c.lineSoft}`,
};
const main: React.CSSProperties = {
  width: "min(650px, 100%)",
  boxSizing: "border-box",
  margin: "0 auto",
  padding: "54px 20px 90px",
};
const eyebrow: React.CSSProperties = {
  fontFamily: f.mono,
  color: c.orangeDark,
  fontSize: 12,
  letterSpacing: "0.1em",
  marginBottom: 8,
};
const heading: React.CSSProperties = {
  fontFamily: f.display,
  fontWeight: 900,
  fontSize: "clamp(36px, 8vw, 54px)",
  lineHeight: 1,
  margin: "0 0 24px",
};
const card: React.CSSProperties = {
  background: c.paper,
  border: `1px solid ${c.line}`,
  boxShadow: shadow.card,
  borderRadius: 5,
  padding: "clamp(20px, 5vw, 30px)",
};
const intro: React.CSSProperties = {
  color: c.body,
  lineHeight: 1.55,
  margin: "0 0 22px",
};
const label: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 7,
  fontFamily: f.mono,
  fontSize: 11,
  letterSpacing: "0.07em",
  marginTop: 16,
};
const input: React.CSSProperties = {
  minHeight: 48,
  boxSizing: "border-box",
  width: "100%",
  border: `1px solid ${c.line}`,
  borderRadius: 4,
  background: c.paperAlt,
  color: c.ink,
  padding: "11px 12px",
  fontFamily: f.sans,
  fontSize: 16,
};
const textarea: React.CSSProperties = {
  ...input,
  minHeight: 150,
  resize: "vertical",
  lineHeight: 1.5,
};
const button: React.CSSProperties = {
  width: "100%",
  minHeight: 50,
  border: 0,
  borderRadius: 4,
  background: c.orange,
  color: c.paper,
  fontFamily: f.display,
  fontSize: 17,
  fontWeight: 800,
  marginTop: 22,
  cursor: "pointer",
};
const primaryLink: React.CSSProperties = {
  display: "inline-block",
  padding: "12px 16px",
  borderRadius: 4,
  background: c.ink,
  color: c.paper,
  textDecoration: "none",
  fontWeight: 800,
};
const errorCard: React.CSSProperties = {
  padding: "11px 12px",
  color: c.red,
  background: "#FDECEA",
  border: `1px solid ${c.red}`,
  borderRadius: 4,
  lineHeight: 1.45,
};
const fallback: React.CSSProperties = {
  color: c.muted,
  fontSize: 13,
  lineHeight: 1.5,
  margin: "14px 0 0",
  textAlign: "center",
};
const honeypot: React.CSSProperties = {
  position: "absolute",
  left: "-10000px",
  width: 1,
  height: 1,
  overflow: "hidden",
};
