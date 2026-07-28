"use client";

import { useState } from "react";
import Link from "next/link";
import { c, f } from "@/lib/theme";
import { sendExistingPreview } from "./[id]/actions";

export function ExistingBuild({
  submissionId,
  customerEmail,
  companyName,
  slug,
  previewUrl,
  imported,
  status,
}: {
  submissionId: string;
  customerEmail: string;
  companyName: string;
  slug: string;
  previewUrl: string;
  imported: number;
  status: string;
}) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">(
    status === "preview_sent" || status === "activated" ? "sent" : "idle",
  );
  const [message, setMessage] = useState<string | null>(null);

  async function sendPreview() {
    setState("sending");
    setMessage(null);
    try {
      const result = await sendExistingPreview(submissionId);
      if (!result.ok) {
        setState("error");
        setMessage(result.error);
        return;
      }
      setState("sent");
      setMessage(`Preview sent to ${customerEmail}.`);
    } catch (reason) {
      setState("error");
      setMessage(
        reason instanceof Error ? reason.message : "The preview email failed.",
      );
    }
  }

  return (
    <div
      style={{
        maxWidth: 720,
        background: c.paper,
        border: `1px solid ${c.line}`,
        borderRadius: 4,
        padding: "24px 26px",
      }}
    >
      <div
        style={{
          fontFamily: f.mono,
          fontSize: 11,
          color: c.green,
          letterSpacing: "0.08em",
          marginBottom: 8,
        }}
      >
        BUILD EXISTS
      </div>
      <h1
        style={{
          margin: "0 0 8px",
          fontFamily: f.display,
          fontSize: 26,
          fontWeight: 900,
        }}
      >
        {companyName}
      </h1>
      <p style={{ margin: "0 0 18px", color: c.muted, lineHeight: 1.5 }}>
        {imported} rows imported. Open the preview, open the signed-in app, or
        send the customer their link.
      </p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <a href={previewUrl} target="_blank" rel="noreferrer" style={darkLink}>
          Open preview
        </a>
        <a
          href={`/app/${slug}`}
          target="_blank"
          rel="noreferrer"
          style={lightLink}
        >
          Open app
        </a>
        <button
          type="button"
          onClick={sendPreview}
          disabled={state === "sending" || state === "sent"}
          style={{
            ...orangeButton,
            opacity: state === "sending" || state === "sent" ? 0.6 : 1,
            cursor: state === "sending" ? "wait" : "pointer",
          }}
        >
          {state === "sending"
            ? "Sending..."
            : state === "sent"
              ? "Preview sent"
              : "Email preview"}
        </button>
        <Link href="/ops" style={lightLink}>
          Back to inbox
        </Link>
      </div>

      {message && (
        <div
          role={state === "error" ? "alert" : "status"}
          style={{
            marginTop: 14,
            color: state === "error" ? c.red : c.green,
            fontSize: 13,
          }}
        >
          {message}
        </div>
      )}
    </div>
  );
}

const linkBase: React.CSSProperties = {
  display: "inline-block",
  borderRadius: 3,
  padding: "10px 14px",
  fontFamily: f.mono,
  fontSize: 12,
  textDecoration: "none",
};

const darkLink: React.CSSProperties = {
  ...linkBase,
  background: c.ink,
  color: c.paper,
};

const lightLink: React.CSSProperties = {
  ...linkBase,
  background: c.paper,
  color: c.ink,
  border: `1px solid ${c.line}`,
  padding: "9px 14px",
};

const orangeButton: React.CSSProperties = {
  ...linkBase,
  background: c.orange,
  color: c.paper,
  border: "none",
};
