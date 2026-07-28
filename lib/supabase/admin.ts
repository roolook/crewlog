import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client. Bypasses RLS, so it is only ever constructed inside
 * server actions and route handlers that have already checked authorisation
 * (see `requireOperator`). Never import this from a client component.
 */
export function supabaseAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set - required for intake and ops.",
    );
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
