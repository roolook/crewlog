import Link from "next/link";
import { Brand } from "@/components/Brand";
import { Arrow } from "@/components/Icon";
import { c, f } from "@/lib/theme";
import { LoginForm } from "./LoginForm";

export const metadata = {
  title: "CrewLog - log in",
  robots: { index: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; invite?: string }>;
}) {
  const { next, error, invite } = await searchParams;

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 20px",
          borderBottom: `1px solid ${c.lineSoft}`,
        }}
      >
        <Brand />
        <Link
          href="/start"
          className="cl-link-muted"
          style={{
            fontFamily: f.mono,
            fontSize: 12,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          Not a customer yet?
          <Arrow size={12} />
        </Link>
      </header>

      <main
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "32px 20px 80px",
        }}
      >
        <div style={{ width: "100%", maxWidth: 420 }}>
          {error && (
            <div
              role="alert"
              style={{
                marginBottom: 16,
                fontSize: 14,
                color: c.red,
                background: "#FDECEA",
                border: `1px solid ${c.red}`,
                borderRadius: 4,
                padding: "10px 12px",
              }}
            >
              {error === "expired"
                ? "That link expired. Here's a fresh one - send yourself another."
                : error}
            </div>
          )}
          <LoginForm
            next={next && next.startsWith("/") ? next : "/app"}
            invite={invite}
          />
          <div
            style={{
              textAlign: "center",
              fontFamily: f.mono,
              fontSize: 11,
              color: c.faint,
              marginTop: 18,
            }}
          >
            built by CREWLOG
          </div>
        </div>
      </main>
    </div>
  );
}
