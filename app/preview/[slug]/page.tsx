import Link from "next/link";
import { notFound } from "next/navigation";
import { Brand } from "@/components/Brand";
import { AppShell } from "@/components/app/AppShell";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { c, f } from "@/lib/theme";
import type { Entry, Member, TenantField, Tenant } from "@/lib/types";
import { ActivatePanel } from "./ActivatePanel";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Your app is ready — CrewLog",
  robots: { index: false },
};

/**
 * The page the "Your app is ready" email links to. Authorised by the preview
 * token in the URL rather than a login, because the whole point is that the
 * customer has no account yet.
 *
 * The embedded app is loaded with their real rows but runs on local state: a
 * visitor can add, edit and delete freely — "break it if you can" — without an
 * unauthenticated write path into a real tenant's log. Everything persists once
 * they activate and sign in.
 */
export default async function PreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { slug } = await params;
  const { t: token } = await searchParams;
  if (!token) notFound();

  const admin = supabaseAdmin();
  const { data: tenant } = await admin
    .from("tenants")
    .select("*")
    .eq("slug", slug)
    .maybeSingle<Tenant & { preview_token: string }>();

  if (!tenant || tenant.preview_token !== token) notFound();

  const [{ data: fields }, { data: entries }, { data: members }] =
    await Promise.all([
      admin
        .from("tenant_fields")
        .select("*")
        .eq("tenant_id", tenant.id)
        .order("position"),
      admin
        .from("entries")
        .select("*")
        .eq("tenant_id", tenant.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(200),
      admin
        .from("tenant_members")
        .select("*")
        .eq("tenant_id", tenant.id)
        .neq("status", "removed"),
    ]);

  const firstName = (tenant.owner_name ?? "").trim().split(/\s+/)[0] || "there";
  const expires = tenant.preview_expires_at
    ? new Date(tenant.preview_expires_at)
    : new Date(Date.now() + 7 * 86_400_000);

  return (
    <>
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
        <div style={{ fontFamily: f.mono, fontSize: 12, color: c.muted }}>
          preview · {tenant.slug}
        </div>
      </header>

      <main style={{ maxWidth: 980, margin: "0 auto", padding: "48px 20px 90px" }}>
        <div style={{ textAlign: "center", maxWidth: 640, margin: "0 auto 40px" }}>
          <div
            style={{
              fontFamily: f.mono,
              fontSize: 13,
              letterSpacing: "0.1em",
              color: c.muted,
              marginBottom: 14,
            }}
          >
            BUILT FROM{" "}
            <span
              style={{
                background: c.paper,
                border: `1px solid ${c.line}`,
                padding: "2px 7px",
                color: c.ink,
              }}
            >
              {tenant.source_file_name ?? "your spreadsheet"}
            </span>{" "}
            — {(fields ?? []).length} COLUMNS, {tenant.source_row_count} ROWS, ALL
            IN.
          </div>
          <h1
            style={{
              fontFamily: f.display,
              fontWeight: 900,
              fontSize: "clamp(30px, 5vw, 46px)",
              lineHeight: 1.05,
              margin: "0 0 12px",
            }}
          >
            {firstName}, this is your app.
          </h1>
          <p
            style={{
              fontSize: 18,
              color: c.body,
              lineHeight: 1.55,
              margin: 0,
            }}
          >
            It&apos;s live right now, loaded with your rows. Log something. Search
            it. Break it if you can. Nobody&apos;s watching a demo — this is
            yours.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 48,
            alignItems: "flex-start",
            justifyContent: "center",
          }}
        >
          <div style={{ flex: "0 0 auto" }}>
            <div
              style={{
                width: 340,
                height: 660,
                border: `11px solid ${c.ink}`,
                borderRadius: 42,
                overflow: "hidden",
                background: c.paper,
                boxShadow: "0 20px 44px rgba(23,24,27,0.22)",
              }}
            >
              <AppShell
                bundle={{
                  tenant,
                  fields: (fields ?? []) as TenantField[],
                  entries: (entries ?? []) as Entry[],
                  members: (members ?? []) as Member[],
                  viewerRole: "owner",
                  viewerName: tenant.owner_name ?? "you",
                }}
                embedded
              />
            </div>
            <div
              style={{
                textAlign: "center",
                fontFamily: f.mono,
                fontSize: 12,
                color: c.muted,
                marginTop: 12,
              }}
            >
              fully working · your real data
            </div>
          </div>

          <div style={{ flex: "1 1 380px", minWidth: 300, maxWidth: 440 }}>
            <ActivatePanel
              slug={tenant.slug}
              token={token}
              alreadyActive={tenant.status === "active"}
              expiresLabel={expires
                .toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })
                .toUpperCase()}
            />
          </div>
        </div>
      </main>

      <footer
        style={{
          maxWidth: 980,
          margin: "0 auto",
          padding: 20,
          borderTop: `1px solid ${c.lineSoft}`,
          fontFamily: f.mono,
          fontSize: 12,
          color: c.muted,
          display: "flex",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <span>CREWLOG · build@crewlog.app</span>
        <Link href="/" style={{ color: c.muted }}>
          crewlog.app
        </Link>
      </footer>
    </>
  );
}
