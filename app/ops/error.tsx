"use client";

import Link from "next/link";
import { c, f } from "@/lib/theme";

export default function OpsError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      role="alert"
      style={{
        maxWidth: 640,
        background: c.paper,
        border: `1px solid ${c.red}`,
        borderRadius: 4,
        padding: "24px 26px",
      }}
    >
      <h1
        style={{
          margin: "0 0 8px",
          fontFamily: f.display,
          fontSize: 24,
          fontWeight: 900,
        }}
      >
        This operator screen did not load.
      </h1>
      <p style={{ margin: "0 0 18px", color: c.muted, lineHeight: 1.5 }}>
        Try the request again. If it keeps failing, return to the inbox.
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={reset}
          style={{
            border: "none",
            borderRadius: 3,
            background: c.orange,
            color: c.paper,
            padding: "10px 14px",
            fontFamily: f.mono,
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          Try again
        </button>
        <Link
          href="/ops"
          style={{
            border: `1px solid ${c.line}`,
            borderRadius: 3,
            color: c.ink,
            padding: "9px 14px",
            fontFamily: f.mono,
            fontSize: 12,
            textDecoration: "none",
          }}
        >
          Back to inbox
        </Link>
      </div>
    </div>
  );
}
