import { clerkMiddleware } from "@clerk/nextjs/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import {
  NextResponse,
  type NextFetchEvent,
  type NextRequest,
} from "next/server";
import { identityProviderName } from "@/lib/identity/config";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/**
 * Refreshes the Supabase session cookie on every navigation. Without this the
 * "stays signed in 90 days on your phone" promise breaks as soon as the access
 * token expires mid-session.
 */
async function refreshSupabaseSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // Let the app boot (and show its own setup notice) before env is configured.
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(toSet: CookieToSet[]) {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  await supabase.auth.getUser();
  return response;
}

const withClerk = clerkMiddleware(
  async (_auth, request) => refreshSupabaseSession(request),
);

export default function middleware(
  request: NextRequest,
  event: NextFetchEvent,
) {
  if (identityProviderName() === "clerk") return withClerk(request, event);
  return refreshSupabaseSession(request);
}

export const config = {
  matcher: [
    // Everything except static assets and image files.
    "/((?!_next/static|_next/image|favicon|assets|manifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
