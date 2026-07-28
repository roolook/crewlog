import { requireOperator } from "@/lib/auth";
import { SignOutControl } from "@/components/auth/SignOutControl";
import { c, f } from "@/lib/theme";
import { OpsNav } from "./OpsNav";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "CrewLog - operator console",
  robots: { index: false },
};

export default async function OpsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await requireOperator();

  return (
    <>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 24,
          padding: "12px 20px",
          background: c.ink,
          color: c.paper,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 12, height: 12, background: c.orange }} />
          <div style={{ fontFamily: f.display, fontWeight: 900, fontSize: 16 }}>
            CREWLOG{" "}
            <span style={{ color: c.faint, fontWeight: 700 }}>/ OPS</span>
          </div>
        </div>
        <OpsNav />
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontFamily: f.mono,
            fontSize: 11,
            color: c.faint,
          }}
        >
          <span>operator: {user.email}</span>
          <SignOutControl />
        </div>
      </header>
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 20px 80px" }}>
        {children}
      </main>
    </>
  );
}
