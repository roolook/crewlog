import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { claimInviteToken, claimPendingMemberships } from "@/lib/membership";

/**
 * Where magic links land. Exchanges the code for a session, then forwards to
 * wherever the user was headed. An `invite` token means the link came from a
 * crew invite, so we claim that membership row before continuing.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const invite = url.searchParams.get("invite");
  const next = url.searchParams.get("next");

  const dest = next && next.startsWith("/") ? next : "/app";
  const supabase = await supabaseServer();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return redirectToLogin(url, dest, "expired");
  } else if (tokenHash && isEmailOtpType(type)) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    if (error) return redirectToLogin(url, dest, "expired");
  } else {
    return redirectToLogin(url, dest, "That link was incomplete.");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    // Attach any seat that was waiting on this email address. Covers the owner
    // of a freshly generated tenant and crew invited to a second company —
    // neither triggers the signup hook if they already had an account.
    await claimPendingMemberships(user.id, user.email);

    if (invite) {
      // A specific invite link also claims its own seat, which lets someone be
      // invited at an address other than the one they sign in with.
      await claimInviteToken(user.id, invite);
    }
  }

  return NextResponse.redirect(new URL(dest, url.origin));
}

/**
 * Every email OTP type Supabase can put in a link. `signup` is the one that
 * matters in practice: a first-time user's confirmation link carries that type,
 * and narrowing the set to magiclink/recovery silently rejects them.
 */
const EMAIL_OTP_TYPES = [
  "magiclink",
  "signup",
  "invite",
  "recovery",
  "email",
  "email_change",
] as const;

type EmailOtpType = (typeof EMAIL_OTP_TYPES)[number];

function isEmailOtpType(v: string | null): v is EmailOtpType {
  return !!v && (EMAIL_OTP_TYPES as readonly string[]).includes(v);
}

function redirectToLogin(url: URL, next: string, error: string) {
  const to = new URL("/login", url.origin);
  to.searchParams.set("error", error);
  to.searchParams.set("next", next);
  return NextResponse.redirect(to);
}
