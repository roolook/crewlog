import { ClerkProvider } from "@clerk/nextjs";
import {
  clerkConfigurationIssue,
  identityProviderName,
} from "@/lib/identity/config";

export function IdentityRootProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  if (
    identityProviderName() !== "clerk" ||
    clerkConfigurationIssue() !== null
  ) {
    return children;
  }

  return (
    <ClerkProvider signInUrl="/login" signUpUrl="/login">
      {children}
    </ClerkProvider>
  );
}
