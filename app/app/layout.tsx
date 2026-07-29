import { IdentityRootProvider } from "@/components/auth/IdentityRootProvider";

export default function CustomerAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <IdentityRootProvider>{children}</IdentityRootProvider>;
}
