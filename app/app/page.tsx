import Link from "next/link";
import { redirect } from "next/navigation";
import { Brand } from "@/components/Brand";
import { myTenants } from "@/lib/auth";
import { currentUser } from "@/lib/supabase/server";
import { c, f, shadow } from "@/lib/theme";

export const dynamic = "force-dynamic";
export const metadata = { title: "CrewLog", robots: { index: false } };

/**
 * Most people belong to exactly one log, so this bounces straight through to
 * it. The picker only ever appears for someone in more than one company.
 */
export default async function AppIndexPage() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/app");

  const tenants = await myTenants();

  if (tenants.length === 1) redirect(`/app/${tenants[0].slug}`);

  if (tenants.length === 0) {
    return (
      <Centered>
        <div
          style={{
            fontFamily: f.display,
            fontWeight: 900,
            fontSize: 24,
            marginBottom: 10,
          }}
        >
          You&apos;re signed in, but no log yet.
        </div>
        <p style={{ fontSize: 16, lineHeight: 1.55, color: c.body, margin: 0 }}>
          If you were invited, ask whoever invited you to re-send the link - it
          has to be the same email you just used ({user.email}).
        </p>
        <p style={{ fontSize: 16, lineHeight: 1.55, color: c.body }}>
          If you sent us a spreadsheet, your preview link arrives by email within
          48 hours.
        </p>
        <Link
          href="/start"
          className="cl-btn-orange"
          style={{
            display: "inline-block",
            marginTop: 12,
            background: c.orange,
            color: c.paper,
            textDecoration: "none",
            fontFamily: f.display,
            fontWeight: 700,
            fontSize: 16,
            padding: "14px 22px",
            borderRadius: 4,
          }}
        >
          Send a spreadsheet
        </Link>
      </Centered>
    );
  }

  return (
    <Centered>
      <div
        style={{
          fontFamily: f.mono,
          fontSize: 11,
          letterSpacing: "0.12em",
          color: c.muted,
          marginBottom: 14,
        }}
      >
        YOUR LOGS
      </div>
      <div
        style={{
          background: c.paper,
          border: `1px solid ${c.line}`,
          borderRadius: 2,
          boxShadow: shadow.card,
          overflow: "hidden",
        }}
      >
        {tenants.map((t) => (
          <Link
            key={t.id}
            href={`/app/${t.slug}`}
            className="cl-row-hover"
            style={{
              display: "block",
              padding: "16px 18px",
              borderBottom: `1px solid ${c.lineHair}`,
              textDecoration: "none",
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 18, color: c.ink }}>
              {t.name}
            </div>
            <div
              style={{
                fontFamily: f.mono,
                fontSize: 12,
                color: c.muted,
                marginTop: 3,
              }}
            >
              {t.log_label} · {t.status}
            </div>
          </Link>
        ))}
      </div>
    </Centered>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
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
        <div style={{ width: "100%", maxWidth: 460 }}>{children}</div>
      </main>
    </div>
  );
}
