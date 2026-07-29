import { NextResponse, type NextRequest } from "next/server";
import { loginPath } from "@/lib/identity/config";
import { currentIdentity } from "@/lib/identity/server";
import { ensureSupabaseSession } from "@/lib/identity/supabase-bridge";

function isValidRedirectTarget(path: string | null): boolean {
  if (!path) return false;
  return path.startsWith("/") && !path.startsWith("//") && !path.includes("\\");
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const requestedNext = url.searchParams.get("next");
  const next = isValidRedirectTarget(requestedNext) ? requestedNext! : "/app";
  const invite = url.searchParams.get("invite") ?? undefined;

  const identity = await currentIdentity();
  if (!identity) {
    return NextResponse.redirect(
      new URL(loginPath(next, invite), url.origin),
    );
  }

  try {
    await ensureSupabaseSession(identity, invite);
    return NextResponse.redirect(new URL(next, url.origin));
  } catch (error) {
    console.error("Identity session bridge failed", error);
    const login = new URL(loginPath(next, invite), url.origin);
    login.searchParams.set("error", "session");
    return NextResponse.redirect(login);
  }
}
