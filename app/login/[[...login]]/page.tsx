import Link from "next/link";
import { redirect } from "next/navigation";
import { Brand } from "@/components/Brand";
import { Arrow } from "@/components/Icon";
import {
  clerkConfigurationIssue,
  identityProviderName,
} from "@/lib/identity/config";
import { c, f } from "@/lib/theme";
import { ClerkLoginPanel } from "../ClerkLoginPanel";
import { LoginForm } from "../LoginForm";
import { currentIdentity } from "@/lib/identity/server";
import { ensureSupabaseSession } from "@/lib/identity/supabase-bridge";
import { IdentityRootProvider } from "@/components/auth/IdentityRootProvider";

export const metadata = {
  title: "CrewLog - log in",
  robots: { index: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; invite?: string }>;
}) {
  const { next, error, invite } = await searchParams;
  const destination = next && next.startsWith("/") ? next : "/app";
  const complete = new URLSearchParams({ next: destination });
  if (invite) complete.set("invite", invite);
  const afterSignIn = `/auth/complete?${complete.toString()}`;
  const usingClerk = identityProviderName() === "clerk";
  const configurationIssue = clerkConfigurationIssue();

  if (usingClerk && !configurationIssue) {
    const identity = await currentIdentity();
    if (identity) {
      try {
        await ensureSupabaseSession(identity, invite);
        redirect(destination);
      } catch (bridgeError) {
        if (
          bridgeError &&
          typeof bridgeError === "object" &&
          "digest" in bridgeError
        ) {
          throw bridgeError;
        }
        console.error("Login session bridge failed", bridgeError);
      }
    }
  }

  return (
    <IdentityRootProvider>
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 20px",
          borderBottom: `1px solid ${c.lineSoft}`,
        }}
      >
        <Brand />
        <Link
          href="/start"
          className="cl-link-muted"
          style={{
            fontFamily: f.mono,
            fontSize: 12,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          Not a customer yet?
          <Arrow size={12} />
        </Link>
      </header>

      <main
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "32px 20px 80px",
        }}
      >
        <div style={{ width: "100%", maxWidth: 420 }}>
          {error && (
            <div
              role="alert"
              style={{
                marginBottom: 16,
                fontSize: 14,
                color: c.red,
                background: "#FDECEA",
                border: `1px solid ${c.red}`,
                borderRadius: 4,
                padding: "10px 12px",
              }}
            >
              {error === "expired"
                ? "That link expired. Here's a fresh one - send yourself another."
                : error === "session"
                  ? "We couldn't finish signing you in. Please try again."
                  : error}
            </div>
          )}
          {usingClerk ? (
            <>
              <div style={{ marginBottom: 18 }}>
                <h1
                  style={{
                    margin: 0,
                    fontFamily: f.display,
                    fontSize: 30,
                    lineHeight: 1.1,
                    fontWeight: 900,
                  }}
                >
                  Sign in to CrewLog.
                </h1>
                <p
                  style={{
                    margin: "8px 0 0",
                    color: c.muted,
                    fontSize: 15,
                    lineHeight: 1.5,
                  }}
                >
                  Use Google or your email. CrewLog keeps you signed in on this
                  device.
                </p>
              </div>
              {configurationIssue ? (
                <div role="alert" style={configurationError}>
                  <strong>Sign-in is temporarily unavailable.</strong>
                  <p style={{ margin: "6px 0 0", lineHeight: 1.5 }}>
                    {configurationIssue} Please email{" "}
                    <a href="mailto:build@crewlog.app">build@crewlog.app</a> so
                    we can help.
                  </p>
                </div>
              ) : (
                <ClerkLoginPanel afterSignIn={afterSignIn} />
              )}
            </>
          ) : (
            <LoginForm next={destination} invite={invite} />
          )}
          <div
            style={{
              textAlign: "center",
              fontFamily: f.mono,
              fontSize: 11,
              color: c.faint,
              marginTop: 18,
            }}
          >
            built by CREWLOG
          </div>
        </div>
      </main>
    </div>
    </IdentityRootProvider>
  );
}

const configurationError: React.CSSProperties = {
  padding: 18,
  color: c.ink,
  background: "#FDECEA",
  border: `1px solid ${c.red}`,
  borderRadius: 4,
};
