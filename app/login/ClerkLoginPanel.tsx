"use client";

/* eslint-disable @next/next/no-img-element -- Serve Google's official logo asset without image transformation. */

import { useSignIn, useSignUp } from "@clerk/nextjs/legacy";
import { useEffect, useState, type FormEvent } from "react";
import { Arrow } from "@/components/Icon";
import { c, f } from "@/lib/theme";

const googleBrandStyles = `
  @font-face {
    font-family: "CrewLog Google Sans";
    font-style: normal;
    font-weight: 500;
    font-display: swap;
    src: url("/assets/google-sans-medium.ttf") format("truetype");
  }

  .crewlog-google-sign-in-button {
    background: #FFFFFF;
    border: 1px solid #747775;
    border-radius: 4px;
    color: #1F1F1F;
  }

  .crewlog-google-sign-in-button:hover:not(:disabled) {
    background: #F8FAFD;
  }

  .crewlog-google-sign-in-button:focus-visible {
    outline: 2px solid #1A73E8;
    outline-offset: 2px;
  }

  .crewlog-google-sign-in-button:disabled {
    cursor: not-allowed;
    opacity: 0.72;
  }
`;

type Step = "email" | "code" | "password" | "second-code";
type EmailFlow = "sign-in" | "sign-up";

export function ClerkLoginPanel({ afterSignIn }: { afterSignIn: string }) {
  const signInState = useSignIn();
  const signUpState = useSignUp();
  const [step, setStep] = useState<Step>("email");
  const [emailFlow, setEmailFlow] = useState<EmailFlow>("sign-in");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [takingTooLong, setTakingTooLong] = useState(false);

  const loaded = signInState.isLoaded && signUpState.isLoaded;

  useEffect(() => {
    if (loaded) return;
    const timeout = window.setTimeout(() => setTakingTooLong(true), 8000);
    return () => window.clearTimeout(timeout);
  }, [loaded]);

  if (!loaded) {
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
          style={darkButton}
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

  const { signIn, setActive: setActiveSignIn } = signInState;
  const { signUp, setActive: setActiveSignUp } = signUpState;

  async function finish(
    sessionId: string | null,
    setActive: typeof setActiveSignIn,
  ) {
    if (!sessionId) {
      throw new Error("Clerk did not create a session. Please try again.");
    }
    await setActive({ session: sessionId });
    window.location.assign(afterSignIn);
  }

  async function continueAfterSignIn(
    attempt: Awaited<ReturnType<typeof signIn.attemptFirstFactor>>,
  ) {
    if (attempt.status === "complete") {
      await finish(attempt.createdSessionId, setActiveSignIn);
      return;
    }
    if (attempt.status === "needs_second_factor") {
      const emailFactor = attempt.supportedSecondFactors?.find(
        (factor) => factor.strategy === "email_code",
      );
      if (!emailFactor || !("emailAddressId" in emailFactor)) {
        throw new Error(
          "This account uses another verification method. Continue with Google or contact build@crewlog.app.",
        );
      }
      await attempt.prepareSecondFactor({
        strategy: "email_code",
        emailAddressId: emailFactor.emailAddressId,
      });
      setCode("");
      setStep("second-code");
      return;
    }
    throw new Error(
      "This account needs another verification step. Continue with Google or contact build@crewlog.app.",
    );
  }

  async function startGoogle() {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/sso-callback",
        redirectUrlComplete: afterSignIn,
      });
    } catch (error) {
      setMessage(clerkMessage(error));
      setBusy(false);
    }
  }

  async function startEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const identifier = email.trim().toLowerCase();
    if (!identifier || !identifier.includes("@")) {
      setMessage("Enter a complete email address.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const attempt = await signIn.create({ identifier });
      if (attempt.status === "complete") {
        await finish(attempt.createdSessionId, setActiveSignIn);
        return;
      }
      const emailFactor = attempt.supportedFirstFactors?.find(
        (factor) => factor.strategy === "email_code",
      );
      if (emailFactor && "emailAddressId" in emailFactor) {
        await attempt.prepareFirstFactor({
          strategy: "email_code",
          emailAddressId: emailFactor.emailAddressId,
        });
        setEmailFlow("sign-in");
        setCode("");
        setStep("code");
        return;
      }
      const passwordFactor = attempt.supportedFirstFactors?.find(
        (factor) => factor.strategy === "password",
      );
      if (passwordFactor) {
        setPassword("");
        setStep("password");
        return;
      }
      throw new Error(
        "This account does not support email sign-in. Continue with Google.",
      );
    } catch (error) {
      if (!isMissingAccount(error)) {
        setMessage(clerkMessage(error));
        return;
      }
      try {
        const attempt = await signUp.create({ emailAddress: identifier });
        await attempt.prepareEmailAddressVerification({
          strategy: "email_code",
        });
        setEmailFlow("sign-up");
        setCode("");
        setStep("code");
      } catch (signUpError) {
        setMessage(clerkMessage(signUpError));
      }
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (code.trim().length < 6) {
      setMessage("Enter the six-digit code from your email.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      if (step === "second-code") {
        const attempt = await signIn.attemptSecondFactor({
          strategy: "email_code",
          code: code.trim(),
        });
        if (attempt.status !== "complete") {
          throw new Error("That verification did not finish. Try again.");
        }
        await finish(attempt.createdSessionId, setActiveSignIn);
        return;
      }
      if (emailFlow === "sign-up") {
        const attempt = await signUp.attemptEmailAddressVerification({
          code: code.trim(),
        });
        if (attempt.status !== "complete") {
          throw new Error(
            "Your email is verified, but the account still needs information. Continue with Google or contact build@crewlog.app.",
          );
        }
        await finish(attempt.createdSessionId, setActiveSignUp);
        return;
      }
      const attempt = await signIn.attemptFirstFactor({
        strategy: "email_code",
        code: code.trim(),
      });
      await continueAfterSignIn(attempt);
    } catch (error) {
      setMessage(clerkMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!password) {
      setMessage("Enter your password.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const attempt = await signIn.attemptFirstFactor({
        strategy: "password",
        password,
      });
      await continueAfterSignIn(attempt);
    } catch (error) {
      setMessage(clerkMessage(error));
    } finally {
      setBusy(false);
    }
  }

  function goBack() {
    setStep("email");
    setCode("");
    setPassword("");
    setMessage(null);
  }

  return (
    <section aria-label="CrewLog account access" style={accessCard}>
      <style>{googleBrandStyles}</style>
      <div style={ticketHeader}>
        <span>ACCOUNT ACCESS</span>
        <span>SECURE · CLERK</span>
      </div>

      <div style={formBody}>
        {step === "email" ? (
          <>
            <button
              type="button"
              className="crewlog-google-sign-in-button"
              onClick={startGoogle}
              disabled={busy}
              style={googleButton}
            >
              <span aria-hidden="true" style={googleIconViewport}>
                <img
                  src="/assets/google-g-logo.png"
                  alt=""
                  width={20}
                  height={20}
                  style={googleIcon}
                />
              </span>
              <span>Continue with Google</span>
            </button>

            <div style={divider}>
              <span style={dividerRule} />
              <span>OR USE EMAIL</span>
              <span style={dividerRule} />
            </div>

            <form onSubmit={startEmail}>
              <label htmlFor="crewlog-email" style={fieldLabel}>
                EMAIL ADDRESS
              </label>
              <input
                id="crewlog-email"
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setMessage(null);
                }}
                autoComplete="email"
                inputMode="email"
                placeholder="you@company.com"
                disabled={busy}
                style={input}
              />
              <button type="submit" disabled={busy} style={primaryButton}>
                <span>{busy ? "Checking account…" : "Continue with email"}</span>
                <Arrow size={15} color={c.paper} />
              </button>
            </form>
          </>
        ) : (
          <>
            <button type="button" onClick={goBack} style={backButton}>
              ← USE A DIFFERENT EMAIL
            </button>
            <div style={{ marginBottom: 18 }}>
              <div style={stepHeading}>
                {step === "password" ? "Enter your password." : "Check your email."}
              </div>
              <p style={stepCopy}>
                {step === "password"
                  ? `Use the password for ${email}.`
                  : `We sent a six-digit code to ${email}.`}
              </p>
            </div>

            {step === "password" ? (
              <form onSubmit={submitPassword}>
                <label htmlFor="crewlog-password" style={fieldLabel}>
                  PASSWORD
                </label>
                <input
                  id="crewlog-password"
                  type="password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setMessage(null);
                  }}
                  autoComplete="current-password"
                  disabled={busy}
                  style={input}
                />
                <button type="submit" disabled={busy} style={primaryButton}>
                  <span>{busy ? "Signing in…" : "Sign in"}</span>
                  <Arrow size={15} color={c.paper} />
                </button>
              </form>
            ) : (
              <form onSubmit={verifyCode}>
                <label htmlFor="crewlog-code" style={fieldLabel}>
                  VERIFICATION CODE
                </label>
                <input
                  id="crewlog-code"
                  type="text"
                  value={code}
                  onChange={(event) => {
                    setCode(event.target.value.replace(/\D/g, "").slice(0, 6));
                    setMessage(null);
                  }}
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  disabled={busy}
                  autoFocus
                  style={{ ...input, fontFamily: f.mono, letterSpacing: "0.2em" }}
                />
                <button type="submit" disabled={busy} style={primaryButton}>
                  <span>{busy ? "Verifying…" : "Verify and sign in"}</span>
                  <Arrow size={15} color={c.paper} />
                </button>
              </form>
            )}
          </>
        )}

        {message && (
          <div role="alert" style={inlineError}>
            {message}
          </div>
        )}

        <div id="clerk-captcha" style={{ marginTop: 12 }} />
      </div>

      <div style={securityStrip}>
        Clerk handles identity verification. CrewLog never receives your Google
        password or email code.
      </div>
    </section>
  );
}

function clerkErrors(error: unknown) {
  if (!error || typeof error !== "object" || !("errors" in error)) return [];
  const errors = (error as { errors?: unknown }).errors;
  return Array.isArray(errors)
    ? (errors as { code?: string; longMessage?: string; message?: string }[])
    : [];
}

function isMissingAccount(error: unknown) {
  return clerkErrors(error).some(
    (item) =>
      item.code === "form_identifier_not_found" ||
      item.code === "identifier_not_found",
  );
}

function clerkMessage(error: unknown) {
  const first = clerkErrors(error)[0];
  if (first?.code === "form_code_incorrect") {
    return "That code is not correct. Check the email and try again.";
  }
  if (first?.code === "form_password_incorrect") {
    return "That password is not correct. Try again.";
  }
  if (first?.longMessage || first?.message) {
    return first.longMessage ?? first.message ?? "Sign-in could not continue.";
  }
  return error instanceof Error
    ? error.message
    : "Sign-in could not continue. Please try again.";
}

const accessCard: React.CSSProperties = {
  background: c.paper,
  border: `1px solid ${c.line}`,
  boxShadow: "4px 4px 0 rgba(29, 29, 27, 0.16)",
};

const ticketHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  padding: "10px 14px",
  borderBottom: `2px solid ${c.ink}`,
  fontFamily: f.mono,
  fontSize: 10,
  letterSpacing: "0.08em",
  color: c.muted,
};

const formBody: React.CSSProperties = {
  padding: "24px 22px 22px",
};

const googleButton: React.CSSProperties = {
  width: "100%",
  minHeight: 44,
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "0 12px",
  cursor: "pointer",
  fontFamily: '"CrewLog Google Sans", "Google Sans", Arial, sans-serif',
  fontSize: 14,
  fontWeight: 500,
  lineHeight: "20px",
  textAlign: "left",
};

const googleIconViewport: React.CSSProperties = {
  width: 20,
  height: 20,
  flex: "0 0 20px",
};

const googleIcon: React.CSSProperties = {
  display: "block",
  width: 20,
  height: 20,
  objectFit: "contain",
};

const divider: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  margin: "20px 0",
  fontFamily: f.mono,
  fontSize: 10,
  letterSpacing: "0.08em",
  color: c.faint,
};

const dividerRule: React.CSSProperties = {
  flex: 1,
  borderTop: `1px solid ${c.line}`,
};

const fieldLabel: React.CSSProperties = {
  display: "block",
  marginBottom: 7,
  fontFamily: f.mono,
  fontSize: 10,
  letterSpacing: "0.08em",
  color: c.body,
};

const input: React.CSSProperties = {
  width: "100%",
  minHeight: 52,
  boxSizing: "border-box",
  padding: "12px 13px",
  border: `1px solid ${c.ink}`,
  borderRadius: 2,
  background: "#FFF",
  color: c.ink,
  fontFamily: f.sans,
  fontSize: 16,
  outlineColor: c.orange,
};

const primaryButton: React.CSSProperties = {
  width: "100%",
  minHeight: 52,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 9,
  marginTop: 12,
  border: 0,
  borderRadius: 2,
  background: c.orange,
  color: c.paper,
  cursor: "pointer",
  fontFamily: f.display,
  fontSize: 16,
  fontWeight: 900,
};

const backButton: React.CSSProperties = {
  padding: 0,
  marginBottom: 18,
  border: 0,
  background: "transparent",
  color: c.muted,
  cursor: "pointer",
  fontFamily: f.mono,
  fontSize: 10,
};

const stepHeading: React.CSSProperties = {
  fontFamily: f.display,
  fontSize: 22,
  fontWeight: 900,
};

const stepCopy: React.CSSProperties = {
  margin: "6px 0 0",
  color: c.muted,
  fontSize: 14,
  lineHeight: 1.5,
};

const inlineError: React.CSSProperties = {
  marginTop: 14,
  padding: "9px 10px",
  border: `1px solid ${c.red}`,
  background: "#FDECEA",
  color: c.red,
  fontSize: 13,
  lineHeight: 1.4,
};

const securityStrip: React.CSSProperties = {
  padding: "11px 14px",
  borderTop: `1px solid ${c.line}`,
  background: c.paperAlt,
  color: c.muted,
  fontFamily: f.mono,
  fontSize: 10,
  lineHeight: 1.5,
};

const loadingCard: React.CSSProperties = {
  minHeight: 180,
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
  borderRadius: 2,
};

const darkButton: React.CSSProperties = {
  minHeight: 44,
  padding: "10px 14px",
  border: 0,
  borderRadius: 2,
  background: c.ink,
  color: c.paper,
  cursor: "pointer",
  fontFamily: f.display,
  fontWeight: 900,
};
