export type IdentityProviderName = "clerk" | "supabase";

/**
 * One switch owns the identity provider choice. The rest of CrewLog talks to
 * the adapter in this folder, so replacing Clerk does not change product code.
 */
export function identityProviderName(): IdentityProviderName {
  return process.env.AUTH_PROVIDER === "clerk" ? "clerk" : "supabase";
}

export function clerkConfigurationIssue(): string | null {
  if (identityProviderName() !== "clerk") return null;

  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const secretKey = process.env.CLERK_SECRET_KEY;

  if (!publishableKey || !secretKey) {
    return "CrewLog sign-in is not configured.";
  }
  if (!/^pk_(test|live)_/.test(publishableKey) || !/^sk_(test|live)_/.test(secretKey)) {
    return "CrewLog sign-in has an invalid configuration.";
  }
  if (
    publishableKey.startsWith("pk_live_") !== secretKey.startsWith("sk_live_")
  ) {
    return "CrewLog sign-in keys do not belong to the same environment.";
  }

  return null;
}

export function loginPath(next = "/app", invite?: string): string {
  const params = new URLSearchParams({ next });
  if (invite) params.set("invite", invite);
  return `/login?${params.toString()}`;
}
