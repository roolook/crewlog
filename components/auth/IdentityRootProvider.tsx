import { ClerkProvider } from "@clerk/nextjs";
import { identityProviderName } from "@/lib/identity/config";

export function IdentityRootProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  if (identityProviderName() !== "clerk") return children;

  return (
    <ClerkProvider signInUrl="/login" signUpUrl="/login">
      {children}
    </ClerkProvider>
  );
}
