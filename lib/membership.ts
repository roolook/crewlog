import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Attaches a signed-in user to any seat that was created for their email
 * address before they had an account.
 *
 * The `handle_new_user` trigger does this at signup, but it only fires for a
 * *new* auth user. Someone who already has an account — an owner who previously
 * signed in, or a crew member invited to a second company — would otherwise be
 * left holding a `pending` seat forever and land on "no log yet".
 *
 * Runs with the service role because the invitee is not yet a member, so no RLS
 * policy would let them update the row themselves.
 */
export async function claimPendingMemberships(userId: string, email?: string) {
  if (!email) return { claimed: 0 };

  try {
    const { data, error } = await supabaseAdmin()
      .from("tenant_members")
      .update({
        user_id: userId,
        status: "active",
        joined_at: new Date().toISOString(),
      })
      .is("user_id", null)
      .eq("email", email.toLowerCase())
      .select("id");

    if (error) {
      console.error("claimPendingMemberships failed", error);
      return { claimed: 0 };
    }
    return { claimed: data?.length ?? 0 };
  } catch (e) {
    // Missing service-role key shouldn't break the login itself.
    console.error("claimPendingMemberships unavailable", e);
    return { claimed: 0 };
  }
}

/**
 * Claims the one seat a specific invite link was minted for, so a crew member
 * can be invited at one address and sign in with another.
 */
export async function claimInviteToken(userId: string, token: string) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)
  ) {
    return { claimed: 0 };
  }

  try {
    const { data, error } = await supabaseAdmin()
      .from("tenant_members")
      .update({
        user_id: userId,
        status: "active",
        joined_at: new Date().toISOString(),
      })
      .eq("invite_token", token)
      .is("user_id", null)
      .select("id");

    if (error) {
      console.error("claimInviteToken failed", error);
      return { claimed: 0 };
    }
    return { claimed: data?.length ?? 0 };
  } catch (e) {
    console.error("claimInviteToken unavailable", e);
    return { claimed: 0 };
  }
}
