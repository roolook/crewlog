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
      // Clear the Supabase bridge session, but never let a transient bridge
      // request prevent Clerk from signing the person out.
      await fetch("/auth/signout", {
        method: "POST",
        cache: "no-store",
        // A bridge request must never follow a redirect into /login while the
        // Clerk session is still active.
        redirect: "error",
      }).catch(() => null);
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
