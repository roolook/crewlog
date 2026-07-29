"use client";

import { SignIn, useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { c, f } from "@/lib/theme";

export function ClerkLoginPanel({ afterSignIn }: { afterSignIn: string }) {
  const { isLoaded } = useAuth();
  const [takingTooLong, setTakingTooLong] = useState(false);

  useEffect(() => {
    if (isLoaded) return;
    const timeout = window.setTimeout(() => setTakingTooLong(true), 8000);
    return () => window.clearTimeout(timeout);
  }, [isLoaded]);

  if (!isLoaded) {
    return takingTooLong ? (
      <div role="alert" style={loadError}>
        <strong>Sign-in did not load.</strong>
        <p style={{ margin: "6px 0 12px", lineHeight: 1.5 }}>
          Reload this page and try again. If the problem continues, email{" "}
          <a href="mailto:build@crewlog.app">build@crewlog.app</a>.
        </p>
        <button
          type="button"
          className="cl-btn-dark"
          onClick={() => window.location.reload()}
          style={reloadButton}
        >
          Reload sign-in
        </button>
      </div>
    ) : (
      <div role="status" aria-live="polite" style={loadingCard}>
        Loading secure sign-in…
      </div>
    );
  }

  return (
    <SignIn
      path="/login"
      routing="path"
      withSignUp
      forceRedirectUrl={afterSignIn}
      signUpForceRedirectUrl={afterSignIn}
      appearance={{
        variables: {
          colorPrimary: c.orange,
          colorBackground: c.paper,
          colorForeground: c.ink,
          colorMutedForeground: c.muted,
          borderRadius: "2px",
          fontFamily: f.sans,
        },
        elements: {
          rootBox: { width: "100%" },
          cardBox: { width: "100%", boxShadow: "none" },
          card: {
            width: "100%",
            border: `1px solid ${c.line}`,
            boxShadow: "4px 4px 0 rgba(29, 29, 27, 0.16)",
          },
          header: { display: "none" },
          socialButtonsBlockButton: {
            border: `1px solid ${c.body}`,
            boxShadow: "none",
          },
          formButtonPrimary: {
            backgroundColor: c.orange,
            fontFamily: f.display,
            fontWeight: 900,
            boxShadow: "none",
          },
          footerActionLink: { color: c.orange },
        },
      }}
    />
  );
}

const loadingCard: React.CSSProperties = {
  minHeight: 160,
  display: "grid",
  placeItems: "center",
  padding: 24,
  color: c.muted,
  background: c.paper,
  border: `1px solid ${c.line}`,
  borderRadius: 2,
  fontFamily: f.mono,
  fontSize: 12,
};

const loadError: React.CSSProperties = {
  padding: 18,
  color: c.ink,
  background: "#FDECEA",
  border: `1px solid ${c.red}`,
  borderRadius: 4,
};

const reloadButton: React.CSSProperties = {
  minHeight: 44,
  padding: "10px 14px",
  border: 0,
  borderRadius: 3,
  background: c.ink,
  color: c.paper,
  cursor: "pointer",
  fontFamily: f.display,
  fontWeight: 900,
};
