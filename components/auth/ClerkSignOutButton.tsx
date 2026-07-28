"use client";

import { useState } from "react";
import { useClerk } from "@clerk/nextjs";
import { c, f } from "@/lib/theme";

export function ClerkSignOutButton() {
  const clerk = useClerk();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/auth/signout", { method: "POST" });
      await clerk.signOut({ redirectUrl: "/login" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={busy}
      style={{
        background: "none",
        border: "none",
        fontFamily: f.mono,
        fontSize: 12,
        color: c.muted,
        cursor: busy ? "wait" : "pointer",
        textDecoration: "underline",
        opacity: busy ? 0.6 : 1,
      }}
    >
      {busy ? "logging out" : "log out"}
    </button>
  );
}
