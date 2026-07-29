import "server-only";
import type { User } from "@supabase/supabase-js";
import { operatorEmails } from "@/lib/auth";
import { claimInviteToken, claimPendingMemberships } from "@/lib/membership";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import type { AppIdentity } from "./server";

/**
 * CrewLog's RLS model is keyed to Supabase auth UUIDs. Clerk owns the visible
 * sign-in, then this bridge mints the matching Supabase session by verified
 * email. Existing RLS policies and tenant isolation remain unchanged.
 *
 * A future identity provider only needs to produce AppIdentity. This bridge can
 * remain in place until the database identity layer is migrated independently.
 */
export async function ensureSupabaseSession(
  identity: AppIdentity,
  invite?: string,
): Promise<User> {
  if (!identity.emailVerified) {
    throw new Error("Email address must be verified before establishing a session.");
  }

  const supabase = await supabaseServer();
  const {
    data: { user: existing },
  } = await supabase.auth.getUser();

  let user = existing;
  if (user?.email?.toLowerCase() !== identity.email) {
    if (user) await supabase.auth.signOut();

    const { data: link, error: linkError } =
      await supabaseAdmin().auth.admin.generateLink({
        type: "magiclink",
        email: identity.email,
        options: { data: { full_name: identity.name } },
      });

    const tokenHash = link.properties?.hashed_token;
    if (linkError || !tokenHash) {
      throw new Error(linkError?.message ?? "Could not create app session.");
    }

    const { data, error } = await supabase.auth.verifyOtp({
      type: "magiclink",
      token_hash: tokenHash,
    });
    if (error || !data.user) {
      throw new Error(error?.message ?? "Could not verify app session.");
    }
    user = data.user;
  }

  if (!user) throw new Error("Could not establish app session.");

  const admin = supabaseAdmin();
  const { error: profileError } = await admin
    .from("profiles")
    .update({ email: identity.email, full_name: identity.name })
    .eq("id", user.id);
  if (profileError) throw new Error(profileError.message);

  // Require explicit verified identity and established session before operator promotion
  if (identity.emailVerified && user.id && operatorEmails().includes(identity.email)) {
    const { error: operatorError } = await admin
      .from("profiles")
      .update({ is_operator: true })
      .eq("id", user.id);
    if (operatorError) throw new Error(operatorError.message);
  }

  await claimPendingMemberships(user.id, identity.email);
  if (invite) await claimInviteToken(user.id, invite);

  return user;
}
