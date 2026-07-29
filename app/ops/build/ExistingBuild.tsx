"use client";

import { useState } from "react";
import Link from "next/link";
import { c, f } from "@/lib/theme";
import { sendExistingPreview } from "./[id]/actions";
import {
  createTenantApiKey,
  revokeTenantApiKey,
} from "../tenants/[id]/actions";

export function ExistingBuild({
  submissionId,
  customerEmail,
  companyName,
  tenantId,
  slug,
  previewUrl,
  imported,
  status,
  previewSentAt,
  deliveryError,
  apiKeys,
}: {
  submissionId: string;
  customerEmail: string;
  companyName: string;
  tenantId: string;
  slug: string;
  previewUrl: string;
  imported: number;
  status: string;
  previewSentAt: string | null;
  deliveryError: string | null;
  apiKeys: {
    id: string;
    name: string;
    key_prefix: string;
    last_used_at: string | null;
    revoked_at: string | null;
    created_at: string;
  }[];
}) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">(
    status === "preview_sent" || status === "activated" ? "sent" : "idle",
  );
  const [message, setMessage] = useState<string | null>(deliveryError);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [keyCopied, setKeyCopied] = useState(false);
  const [keyBusy, setKeyBusy] = useState(false);

  async function sendPreview() {
    if (
      !window.confirm(
        `Send the preview to ${customerEmail}? This is a customer-facing email.`,
      )
    ) {
      return;
    }
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

  async function generateKey() {
    setKeyBusy(true);
    setMessage(null);
    const result = await createTenantApiKey(tenantId, "Customer integration");
    setKeyBusy(false);
    if (!result.ok) {
      setState("error");
      setMessage(result.error);
      return;
    }
    setNewKey(result.token);
    setKeyCopied(false);
  }

  async function copyKey() {
    if (!newKey) return;
    await navigator.clipboard.writeText(newKey);
    setKeyCopied(true);
  }

  async function revokeKey(keyId: string) {
    setKeyBusy(true);
    const result = await revokeTenantApiKey(tenantId, keyId);
    setKeyBusy(false);
    if (!result.ok) {
      setState("error");
      setMessage(result.error);
      return;
    }
    window.location.reload();
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
      <div
        style={{
          marginBottom: 16,
          padding: 12,
          border: `1px solid ${deliveryError ? c.red : c.line}`,
          background: deliveryError ? "#FDECEA" : c.bg,
          fontFamily: f.mono,
          fontSize: 11,
          lineHeight: 1.5,
        }}
      >
        {status === "preview_sent"
          ? `DELIVERED · ${customerEmail}${previewSentAt ? ` · ${new Date(previewSentAt).toLocaleString()}` : ""}`
          : deliveryError
            ? `DELIVERY FAILED · ${deliveryError} · retry is available`
            : `NOT SENT · QA preview is private`}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link href={`/ops/tenants/${tenantId}`} style={darkLink}>
          Edit and manage build
        </Link>
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
            cursor:
              state === "sending"
                ? "wait"
                : state === "sent"
                  ? "not-allowed"
                  : "pointer",
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

      <section style={apiPanel}>
        <div style={{ fontFamily: f.mono, fontSize: 11, fontWeight: 700 }}>
          APP API
        </div>
        <p style={{ margin: "8px 0 12px", color: c.muted, fontSize: 13, lineHeight: 1.5 }}>
          This key only accesses <strong>{companyName}</strong>. Use it with{" "}
          <code>/api/v1/{slug}/entries</code>. The full key is shown once, so copy it
          before leaving this page.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" onClick={generateKey} disabled={keyBusy} style={darkButton}>
            {keyBusy
              ? "Working..."
              : apiKeys.some((key) => !key.revoked_at)
                ? "Create replacement key"
                : "Create API key"}
          </button>
          <Link href="/docs/app-api" target="_blank" style={lightLink}>
            API documentation
          </Link>
        </div>

        {newKey && (
          <div style={keyReveal}>
            <div style={{ fontFamily: f.mono, fontSize: 11, fontWeight: 700, marginBottom: 8 }}>
              COPY THIS KEY NOW
            </div>
            <code style={{ display: "block", overflowWrap: "anywhere", marginBottom: 10 }}>
              {newKey}
            </code>
            <button type="button" onClick={copyKey} style={lightButton}>
              {keyCopied ? "Copied" : "Copy API key"}
            </button>
          </div>
        )}

        <div style={{ marginTop: 14 }}>
          {apiKeys.length === 0 && (
            <div style={{ color: c.muted, fontSize: 13 }}>No API keys yet.</div>
          )}
          {apiKeys.map((key) => (
            <div key={key.id} style={keyRow}>
              <span>
                {key.key_prefix}… · {key.revoked_at ? "revoked" : key.last_used_at ? "used" : "unused"}
              </span>
              {!key.revoked_at && (
                <button
                  type="button"
                  onClick={() => revokeKey(key.id)}
                  disabled={keyBusy}
                  style={revokeButton}
                >
                  revoke
                </button>
              )}
            </div>
          ))}
        </div>
      </section>
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

const darkButton: React.CSSProperties = {
  ...linkBase,
  background: c.ink,
  color: c.paper,
  border: "none",
  cursor: "pointer",
};

const lightButton: React.CSSProperties = {
  ...lightLink,
  cursor: "pointer",
};

const apiPanel: React.CSSProperties = {
  marginTop: 24,
  paddingTop: 20,
  borderTop: `2px solid ${c.ink}`,
};

const keyReveal: React.CSSProperties = {
  marginTop: 14,
  padding: 12,
  border: `2px solid ${c.ink}`,
  background: c.bg,
};

const keyRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  padding: "9px 0",
  borderBottom: `1px solid ${c.lineFaint}`,
  fontFamily: f.mono,
  fontSize: 12,
};

const revokeButton: React.CSSProperties = {
  border: 0,
  background: "transparent",
  color: c.red,
  fontFamily: f.mono,
  cursor: "pointer",
};
