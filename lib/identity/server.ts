import "server-only";
import { currentUser as currentClerkUser } from "@clerk/nextjs/server";
import { currentUser as currentSupabaseUser } from "@/lib/supabase/server";
import { identityProviderName } from "./config";

export type AppIdentity = {
  provider: "clerk" | "supabase";
  externalId: string;
  email: string;
  name: string;
  emailVerified: boolean;
};

/**
 * Provider-neutral identity lookup. Product code should depend on this shape,
 * not Clerk's User object, so a future first-party provider is a small adapter.
 */
export async function currentIdentity(): Promise<AppIdentity | null> {
  if (identityProviderName() === "clerk") {
    const user = await currentClerkUser();
    if (!user) return null;
    const primaryEmailObj =
      user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId) ??
      user.emailAddresses[0];
    const email = primaryEmailObj?.emailAddress;
    if (!email) return null;

    const emailVerified = primaryEmailObj?.verification?.status === "verified";

    return {
      provider: "clerk",
      externalId: user.id,
      email: email.toLowerCase(),
      name:
        user.fullName ??
        user.firstName ??
        email.slice(0, Math.max(1, email.indexOf("@"))),
      emailVerified,
    };
  }

  const user = await currentSupabaseUser();
  if (!user?.email) return null;

  const name =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : user.email.split("@")[0];

  return {
    provider: "supabase",
    externalId: user.id,
    email: user.email.toLowerCase(),
    name,
    emailVerified: Boolean(user.email_confirmed_at),
  };
}
