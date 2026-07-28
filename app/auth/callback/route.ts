import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

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
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as "magiclink" | "email" | "invite" | "recovery",
    });
    if (error) return redirectToLogin(url, dest, "expired");
  } else {
    return redirectToLogin(url, dest, "That link was incomplete.");
  }

  if (invite) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      // Claim the pending seat this link was created for.
      await supabase
        .from("tenant_members")
        .update({
          user_id: user.id,
          status: "active",
          joined_at: new Date().toISOString(),
        })
        .eq("invite_token", invite)
        .is("user_id", null);
    }
  }

  return NextResponse.redirect(new URL(dest, url.origin));
}

function redirectToLogin(url: URL, next: string, error: string) {
  const to = new URL("/login", url.origin);
  to.searchParams.set("error", error);
  to.searchParams.set("next", next);
  return NextResponse.redirect(to);
}
