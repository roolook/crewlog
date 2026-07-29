import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client. Bypasses RLS, so it is only ever constructed inside
 * server actions and route handlers that have already checked authorisation
 * (see `requireOperator`). Never import this from a client component.
 */
export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    const missing = [
      !url && "NEXT_PUBLIC_SUPABASE_URL",
      !key && "SUPABASE_SERVICE_ROLE_KEY",
    ]
      .filter(Boolean)
      .join(", ");
    console.error(
      `[supabaseAdmin] Missing environment variable(s): ${missing}. Required for intake and ops actions.`,
    );
    throw new Error(
      `Supabase configuration incomplete. Missing required environment variable(s): ${missing}.`,
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
