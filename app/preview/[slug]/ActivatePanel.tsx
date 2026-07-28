"use client";

import { useState } from "react";
import { Check } from "@/components/Icon";
import { PromoSetupPrice } from "@/components/PromoSetupPrice";
import { c, f, stamp } from "@/lib/theme";
import { activateAction, previewInviteAction } from "./actions";

const MONTHLY = process.env.NEXT_PUBLIC_MONTHLY_FEE ?? "10";

export function ActivatePanel({
  slug,
  token,
  alreadyActive,
  expiresLabel,
}: {
  slug: string;
  token: string;
  alreadyActive: boolean;
  expiresLabel: string;
}) {
  const [active, setActive] = useState(alreadyActive);
  const [stamped, setStamped] = useState(alreadyActive);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contact, setContact] = useState("");
  const [invites, setInvites] = useState<string[]>([]);

  async function activate() {
    setBusy(true);
    setError(null);
    const res = await activateAction(slug, token);
    setBusy(false);

    if (!res.ok) {
      setError(res.error);
      return;
    }
    if (res.mode === "redirect") {
      window.location.href = res.url;
      return;
    }
    setActive(true);
    setTimeout(() => setStamped(true), 80);
  }

  async function invite() {
    const value = contact.trim();
    if (!value) return;
    setContact("");
    const res = await previewInviteAction(slug, token, value);
    if (res.ok) setInvites((prev) => [...prev, value]);
    else setError(res.error ?? "Could not send that invite.");
  }

  if (active) {
    return (
      <div style={{ position: "relative", paddingTop: 56 }}>
        <div
          style={stamp(stamped, c.green, {
            top: 0,
            left: 0,
            fontSize: 24,
            padding: "5px 16px",
            opacity: stamped ? 0.9 : 0,
          })}
          aria-hidden
        >
          ACTIVE
        </div>
        <p
          style={{
            fontSize: 18,
            fontWeight: 600,
            lineHeight: 1.5,
            margin: "0 0 6px",
          }}
        >
          Done. It&apos;s yours for real now.
        </p>
        <p
          style={{
            fontSize: 16,
            color: c.body,
            lineHeight: 1.55,
            margin: "0 0 22px",
          }}
        >
          Get the first crew member in while you&apos;re here - apps that get one
          log on day one get used.
        </p>

        <div
          style={{
            background: c.paper,
            border: `2px solid ${c.ink}`,
            borderRadius: 6,
            padding: "20px 18px",
          }}
        >
          <div
            style={{
              fontFamily: f.mono,
              fontSize: 11,
              letterSpacing: "0.1em",
              color: c.muted,
              marginBottom: 10,
            }}
          >
            INVITE YOUR CREW
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && invite()}
              placeholder="name@crew.com or (555) 014-2288"
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: 18,
                padding: "14px 12px",
                border: `1px solid ${c.line}`,
                borderRadius: 5,
                background: "#FFF",
                fontFamily: f.mono,
              }}
            />
            <button
              onClick={invite}
              className="cl-btn-dark"
              style={{
                background: c.ink,
                color: c.paper,
                border: "none",
                fontFamily: f.display,
                fontWeight: 700,
                fontSize: 16,
                padding: "0 18px",
                borderRadius: 5,
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              Send link
            </button>
          </div>

          {invites.map((v) => (
            <div
              key={v}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontFamily: f.mono,
                fontSize: 13,
                marginTop: 12,
                padding: "10px 12px",
                background: c.greenBg,
                border: `1px solid ${c.green}`,
                borderRadius: 5,
                color: c.ink,
              }}
            >
              <span style={{ overflowWrap: "anywhere" }}>{v}</span>
              <span
                style={{
                  color: c.green,
                  flexShrink: 0,
                  marginLeft: 8,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Check color={c.green} size={13} />
                sent
              </span>
            </div>
          ))}

          <div style={{ fontSize: 13, color: c.muted, marginTop: 12 }}>
            They tap the link, they&apos;re in. No password, no app store.
          </div>
        </div>

        {error && (
          <div role="alert" style={{ marginTop: 12, fontSize: 14, color: c.red }}>
            {error}
          </div>
        )}

        <div
          style={{
            fontSize: 14,
            color: c.muted,
            marginTop: 18,
            lineHeight: 1.5,
          }}
        >
          Receipt&apos;s in your email. Reply to it for any change, any time - a
          person reads it.
        </div>
      </div>
    );
  }

  return (
    <div>
      <p
        style={{
          fontSize: 18,
          fontWeight: 600,
          lineHeight: 1.5,
          margin: "0 0 18px",
        }}
      >
        The app works right now - for you. Activate it to bring the crew in:
      </p>

      <div
        style={{
          background: c.paper,
          border: `1px solid ${c.line}`,
          borderRadius: 6,
          padding: "6px 18px",
          marginBottom: 24,
        }}
      >
        {[
          "Invite crew by email or text",
          "CSV export & sheet sync",
          "Change requests - a human handles them",
        ].map((line, i) => (
          <div
            key={line}
            style={{
              display: "flex",
              gap: 12,
              alignItems: "baseline",
              padding: "14px 0",
              borderBottom: i < 2 ? `1px solid ${c.lineFaint}` : undefined,
              fontSize: 16,
            }}
          >
            <Padlock />
            <span>{line}</span>
          </div>
        ))}
      </div>

      <div
        style={{
          fontFamily: f.mono,
          fontSize: 12,
          letterSpacing: "0.08em",
          color: c.orangeDark,
          marginBottom: 12,
        }}
      >
        PREVIEW HOLDS YOUR BUILD UNTIL {expiresLabel} - THEN THE SLOT REOPENS
      </div>

      <button
        onClick={activate}
        disabled={busy}
        className="cl-btn-orange"
        style={{
          display: "block",
          width: "100%",
          background: c.orange,
          color: c.paper,
          border: "none",
          fontFamily: f.display,
          fontWeight: 700,
          fontSize: 18,
          padding: 18,
          borderRadius: 5,
          cursor: busy ? "wait" : "pointer",
          opacity: busy ? 0.7 : 1,
        }}
      >
        {busy ? (
          "One moment…"
        ) : (
          <>
            Activate · <PromoSetupPrice compact inverse /> + ${MONTHLY}/mo
          </>
        )}
      </button>

      {error && (
        <div
          role="alert"
          style={{
            marginTop: 12,
            fontSize: 14,
            color: c.red,
            background: "#FDECEA",
            border: `1px solid ${c.red}`,
            borderRadius: 5,
            padding: "10px 12px",
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          fontSize: 14,
          color: c.muted,
          marginTop: 10,
          fontStyle: "italic",
          textAlign: "center",
        }}
      >
        Cancel anytime. Full CSV export the day you ask.
      </div>

      <div
        style={{
          borderTop: `1px solid ${c.lineSoft}`,
          marginTop: 30,
          paddingTop: 20,
          fontSize: 16,
          color: c.body,
          lineHeight: 1.55,
        }}
      >
        Something&apos;s off?{" "}
        <a
          href={`mailto:build@crewlog.app?subject=${encodeURIComponent(
            `Fix before I pay - ${slug}`,
          )}`}
        >
          Reply to the email
        </a>{" "}
        - we&apos;ll fix it before you pay.
      </div>
    </div>
  );
}

/** The little padlock drawn in the design's locked-feature list. */
function Padlock() {
  return (
    <span
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        flexShrink: 0,
        transform: "translateY(2px)",
      }}
      aria-hidden
    >
      <span
        style={{
          width: 8,
          height: 6,
          border: `2px solid ${c.muted}`,
          borderBottom: "none",
          borderRadius: "5px 5px 0 0",
        }}
      />
      <span
        style={{ width: 14, height: 9, background: c.muted, borderRadius: 2 }}
      />
    </span>
  );
}
