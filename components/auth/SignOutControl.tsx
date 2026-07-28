import { identityProviderName } from "@/lib/identity/config";
import { c, f } from "@/lib/theme";
import { ClerkSignOutButton } from "./ClerkSignOutButton";

export function SignOutControl() {
  if (identityProviderName() === "clerk") return <ClerkSignOutButton />;

  return (
    <form action="/auth/signout" method="post">
      <button
        type="submit"
        style={{
          background: "none",
          border: "none",
          fontFamily: f.mono,
          fontSize: 12,
          color: c.muted,
          cursor: "pointer",
          textDecoration: "underline",
        }}
      >
        log out
      </button>
    </form>
  );
}
