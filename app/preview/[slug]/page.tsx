import Link from "next/link";
import { notFound } from "next/navigation";
import { Brand } from "@/components/Brand";
import { AppShell } from "@/components/app/AppShell";
import { UploadedHtmlApp } from "@/components/app/UploadedHtmlApp";
import { supabaseServer } from "@/lib/supabase/server";
import { c, f } from "@/lib/theme";
import { themeFromFields } from "@/lib/app-theme";
import { CUSTOM_HTML_FIELD_KEY } from "@/lib/custom-html";
import type { Entry, Member, TenantField, Tenant } from "@/lib/types";
import { ActivatePanel } from "./ActivatePanel";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Your app is ready - CrewLog",
  robots: { index: false },
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { slug } = await params;
  const { t: token } = await searchParams;
  if (!token || !UUID_REGEX.test(token)) notFound();

  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("get_preview_bundle", {
    p_slug: slug,
    p_token: token,
  });

  if (error || !data) {
    notFound();
  }

  if (data.valid === false) {
    if (data.reason === "expired") {
      const tenantName = data.tenant?.name ?? slug;
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
              preview · {slug}
            </div>
          </header>

          <main
            style={{
              maxWidth: 640,
              margin: "80px auto",
              padding: "0 20px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                background: c.paper,
                border: `2px solid ${c.line}`,
                borderRadius: 8,
                padding: 36,
                boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
              }}
            >
              <div
                style={{
                  fontFamily: f.mono,
                  fontSize: 12,
                  color: c.orangeDark,
                  letterSpacing: "0.1em",
                  marginBottom: 12,
                }}
              >
                PREVIEW LINK EXPIRED
              </div>
              <h1
                style={{
                  fontFamily: f.display,
                  fontWeight: 900,
                  fontSize: 32,
                  margin: "0 0 16px",
                }}
              >
                Preview for {tenantName} has expired
              </h1>
              <p
                style={{
                  fontSize: 16,
                  color: c.body,
                  lineHeight: 1.6,
                  margin: "0 0 24px",
                }}
              >
                Preview links are active for 7 days after your app is built. You
                can request a fresh preview link or contact our team to
                reactivate your build.
              </p>
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  justifyContent: "center",
                  flexWrap: "wrap",
                }}
              >
                <Link
                  href={`/start?renew=${encodeURIComponent(slug)}`}
                  style={{
                    background: c.ink,
                    color: c.paper,
                    padding: "14px 24px",
                    borderRadius: 5,
                    fontWeight: 700,
                    textDecoration: "none",
                    fontFamily: f.display,
                  }}
                >
                  Request New Preview Link
                </Link>
                <Link
                  href="/"
                  style={{
                    padding: "14px 24px",
                    borderRadius: 5,
                    color: c.body,
                    textDecoration: "none",
                    fontFamily: f.mono,
                    fontSize: 14,
                  }}
                >
                  Return Home
                </Link>
              </div>
            </div>
          </main>
        </>
      );
    }
    notFound();
  }

  const tenant = data.tenant as Tenant & { preview_token: string };
  const fields = (data.fields ?? []) as TenantField[];
  const entries = (data.entries ?? []) as Entry[];
  const members = (data.members ?? []) as Member[];

  const firstName = (tenant.owner_name ?? "").trim().split(/\s+/)[0] || "there";
  const themed = themeFromFields(fields);
  const customHtml =
    fields.find((field) => field.key === CUSTOM_HTML_FIELD_KEY)
      ?.options?.[0] ?? null;
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

      <main
        style={{ maxWidth: 980, margin: "0 auto", padding: "48px 20px 90px" }}
      >
        <div
          style={{ textAlign: "center", maxWidth: 640, margin: "0 auto 40px" }}
        >
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
            - {themed.fields.length} COLUMNS, {tenant.source_row_count} ROWS, ALL
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
            it. Break it if you can. Nobody&apos;s watching a demo - this is
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
              {customHtml && tenant.custom_app_key === "uploaded-html" ? (
                <UploadedHtmlApp
                  bundle={{
                    tenant,
                    customHtml,
                    theme: themed.theme,
                    fields: themed.fields,
                    entries,
                    members,
                    viewerRole: "owner",
                    viewerName: tenant.owner_name ?? "you",
                  }}
                />
              ) : (
                <AppShell
                  bundle={{
                    tenant,
                    theme: themed.theme,
                    fields: themed.fields,
                    entries,
                    members,
                    viewerRole: "owner",
                    viewerName: tenant.owner_name ?? "you",
                  }}
                  embedded
                />
              )}
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
