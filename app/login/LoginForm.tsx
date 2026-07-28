"use client";

import { useState } from "react";
import { c, f, shadow } from "@/lib/theme";
import { supabaseBrowser } from "@/lib/supabase/client";

/**
 * "No password. Tap the link, you're in." — Supabase magic-link OTP. The email
 * itself is styled to match the rest of the system; paste
 * lib/email/templates.ts → magicLinkEmail into Supabase Auth → Email Templates.
 */
export function LoginForm({
  next = "/app",
  invite,
}: {
  next?: string;
  /** Present when arriving from a crew-invite email; claimed after login. */
  invite?: string;
}) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [message, setMessage] = useState<string | null>(null);

  async function send() {
    const value = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
      setState("error");
      setMessage("That email doesn't look right — check it?");
      return;
    }

    setState("sending");
    const redirect =
      `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` +
      (invite ? `&invite=${encodeURIComponent(invite)}` : "");
    const { error } = await supabaseBrowser().auth.signInWithOtp({
      email: value,
      options: { emailRedirectTo: redirect },
    });

    if (error) {
      setState("error");
      setMessage(error.message);
      return;
    }
    setState("sent");
    setMessage(null);
  }

  if (state === "sent") {
    return (
      <div
        style={{
          background: c.paper,
          border: `1px solid ${c.line}`,
          borderRadius: 2,
          boxShadow: shadow.card,
          padding: "28px 22px",
        }}
      >
        <div
          style={{
            fontFamily: f.display,
            fontWeight: 900,
            fontSize: 22,
            marginBottom: 8,
          }}
        >
          Check your email.
        </div>
        <p style={{ fontSize: 15.5, lineHeight: 1.55, color: c.body, margin: 0 }}>
          We sent a link to{" "}
          <span style={{ fontFamily: f.mono, fontSize: 14 }}>
            {email.trim().toLowerCase()}
          </span>
          . Tap it and you&apos;re in — no password.
        </p>
        <p
          style={{
            fontFamily: f.mono,
            fontSize: 12.5,
            color: c.muted,
            margin: "14px 0 0",
          }}
        >
          expires in 15 minutes · stays signed in 90 days on your phone
        </p>
        <button
          onClick={() => setState("idle")}
          style={{
            marginTop: 18,
            background: "none",
            border: "none",
            fontFamily: f.mono,
            fontSize: 13,
            color: c.muted,
            cursor: "pointer",
            textDecoration: "underline",
            padding: "6px 0",
          }}
        >
          use a different email
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        background: c.paper,
        border: `1px solid ${c.line}`,
        borderRadius: 2,
        boxShadow: shadow.card,
        padding: "28px 22px 26px",
      }}
    >
      <div
        style={{
          fontFamily: f.mono,
          fontSize: 11,
          letterSpacing: "0.12em",
          color: c.muted,
          borderBottom: `2px solid ${c.ink}`,
          paddingBottom: 14,
          marginBottom: 24,
        }}
      >
        CUSTOMER LOGIN · FORM CL-0417
      </div>

      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span
          style={{
            fontFamily: f.mono,
            fontSize: 11,
            letterSpacing: "0.08em",
            color: c.muted,
          }}
        >
          <span style={{ color: c.orange }}>01 /</span> EMAIL
        </span>
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (state === "error") setState("idle");
          }}
          onKeyDown={(e) => e.key === "Enter" && send()}
          style={{
            fontSize: 18,
            padding: "16px 14px",
            border: `1px solid ${c.body}`,
            borderRadius: 2,
            background: "#FFF",
            fontFamily: f.sans,
            width: "100%",
            boxSizing: "border-box",
          }}
        />
      </label>

      <button
        onClick={send}
        disabled={state === "sending"}
        className="cl-btn-orange"
        style={{
          display: "block",
          width: "100%",
          marginTop: 16,
          background: c.orange,
          color: c.paper,
          border: "none",
          fontFamily: f.display,
          fontWeight: 900,
          fontSize: 17,
          letterSpacing: "0.04em",
          padding: 18,
          borderRadius: 2,
          cursor: state === "sending" ? "wait" : "pointer",
          minHeight: 64,
          boxShadow: shadow.button,
          opacity: state === "sending" ? 0.6 : 1,
        }}
      >
        {state === "sending" ? "SENDING…" : "EMAIL ME MY LINK"}
      </button>

      {state === "error" && message && (
        <div
          role="alert"
          style={{
            marginTop: 14,
            fontSize: 14,
            color: c.red,
            background: "#FDECEA",
            border: `1px solid ${c.red}`,
            borderRadius: 4,
            padding: "10px 12px",
          }}
        >
          {message}
        </div>
      )}

      <p style={{ fontSize: 14.5, color: c.muted, margin: "16px 0 0" }}>
        No password. Tap the link, you&apos;re in.
      </p>
    </div>
  );
}
