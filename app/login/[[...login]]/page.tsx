import Link from "next/link";
import { SignIn } from "@clerk/nextjs";
import { Brand } from "@/components/Brand";
import { Arrow } from "@/components/Icon";
import { identityProviderName } from "@/lib/identity/config";
import { c, f } from "@/lib/theme";
import { LoginForm } from "../LoginForm";

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

  return (
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
  );
}
