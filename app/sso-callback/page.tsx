import { IdentityRootProvider } from "@/components/auth/IdentityRootProvider";
import { c, f } from "@/lib/theme";
import { CallbackClient } from "./CallbackClient";

export default function SsoCallbackPage() {
  return (
    <IdentityRootProvider>
      <main
        style={{
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          padding: 20,
          background: c.bg,
        }}
      >
        <div
          role="status"
          style={{
            padding: "18px 22px",
            border: `1px solid ${c.line}`,
            background: c.paper,
            boxShadow: "4px 4px 0 rgba(29, 29, 27, 0.16)",
            color: c.muted,
            fontFamily: f.mono,
            fontSize: 12,
          }}
        >
          Finishing secure sign-in…
        </div>
        <CallbackClient />
      </main>
    </IdentityRootProvider>
  );
}
