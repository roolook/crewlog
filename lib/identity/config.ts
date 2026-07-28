export type IdentityProviderName = "clerk" | "supabase";

/**
 * One switch owns the identity provider choice. The rest of CrewLog talks to
 * the adapter in this folder, so replacing Clerk does not change product code.
 */
export function identityProviderName(): IdentityProviderName {
  return process.env.AUTH_PROVIDER === "clerk" ? "clerk" : "supabase";
}

export function loginPath(next = "/app", invite?: string): string {
  const params = new URLSearchParams({ next });
  if (invite) params.set("invite", invite);
  return `/login?${params.toString()}`;
}
