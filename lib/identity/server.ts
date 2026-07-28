import "server-only";
import { currentUser as currentClerkUser } from "@clerk/nextjs/server";
import { currentUser as currentSupabaseUser } from "@/lib/supabase/server";
import { identityProviderName } from "./config";

export type AppIdentity = {
  provider: "clerk" | "supabase";
  externalId: string;
  email: string;
  name: string;
};

/**
 * Provider-neutral identity lookup. Product code should depend on this shape,
 * not Clerk's User object, so a future first-party provider is a small adapter.
 */
export async function currentIdentity(): Promise<AppIdentity | null> {
  if (identityProviderName() === "clerk") {
    const user = await currentClerkUser();
    const email =
      user?.primaryEmailAddress?.emailAddress ??
      user?.emailAddresses[0]?.emailAddress;
    if (!user || !email) return null;

    return {
      provider: "clerk",
      externalId: user.id,
      email: email.toLowerCase(),
      name:
        user.fullName ??
        user.firstName ??
        email.slice(0, Math.max(1, email.indexOf("@"))),
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
  };
}
