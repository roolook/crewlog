import Link from "next/link";
import { redirect } from "next/navigation";
import { Brand } from "@/components/Brand";
import { SignOutControl } from "@/components/auth/SignOutControl";
import {
  customerDashboardTenants,
  type CustomerDashboardTenant,
} from "@/lib/auth";
import { currentUser } from "@/lib/supabase/server";
import { c, f, shadow } from "@/lib/theme";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your CrewLog apps", robots: { index: false } };

export default async function AppIndexPage() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/app");

  let tenants: CustomerDashboardTenant[] = [];
  let dashboardError: string | null = null;
  try {
    tenants = await customerDashboardTenants();
  } catch (error) {
    console.error("Customer dashboard failed", error);
    dashboardError = "Your apps could not be loaded. Refresh the page to try again.";
  }

  return (
    <div style={{ minHeight: "100dvh" }}>
      <header style={header}>
        <Brand />
        <SignOutControl />
      </header>
      <main style={main}>
        <div style={titleRow}>
          <div>
            <div style={eyebrow}>CUSTOMER DASHBOARD</div>
            <h1 style={heading}>Your CrewLog apps</h1>
            <p style={intro}>
              Open an app, check usage or send us a change request.
            </p>
          </div>
          <Link href="/start" className="cl-btn-orange" style={primaryLink}>
            Start another app
          </Link>
        </div>

        {dashboardError ? (
          <div role="alert" style={errorCard}>
            <strong>We couldn&apos;t open your dashboard.</strong>
            <div style={{ marginTop: 6 }}>{dashboardError}</div>
          </div>
        ) : tenants.length === 0 ? (
          <div style={emptyCard}>
            <h2 style={{ ...cardTitle, margin: 0 }}>No apps are connected yet.</h2>
            <p style={{ color: c.body, lineHeight: 1.55, margin: "10px 0 20px" }}>
              If you already received an invitation, open its link using{" "}
              <strong>{user.email}</strong>. Otherwise, send your current sheet
              and CrewLog will build your first preview.
            </p>
            <Link href="/start" style={primaryLink} className="cl-btn-orange">
              Start my first app
            </Link>
          </div>
        ) : (
          <div style={appGrid}>
            {tenants.map((tenant) => (
              <AppCard key={tenant.tenant_id} tenant={tenant} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function AppCard({ tenant }: { tenant: CustomerDashboardTenant }) {
  const storageLimit = tenant.storage_limit_mb * 1024 * 1024;
  const storagePercent =
    storageLimit > 0
      ? Math.min(100, Math.round((tenant.storage_bytes / storageLimit) * 100))
      : 0;
  const canManageTeam = tenant.role === "owner";
  return (
    <article style={appCard}>
      <div style={cardTop}>
        <div>
          <div style={statusLabel}>{tenant.status.toUpperCase()}</div>
          <h2 style={cardTitle}>{tenant.name}</h2>
        </div>
        <div style={roleBadge}>{tenant.role.toUpperCase()}</div>
      </div>
      <div style={metrics}>
        <Metric label="Entries" value={tenant.entry_count.toLocaleString()} />
        <Metric label="Team" value={tenant.team_member_count.toLocaleString()} />
        <Metric label="Plan" value={planLabel(tenant.plan_tier)} />
        <Metric
          label="Monthly"
          value={
            tenant.monthly_price_cents > 0
              ? `$${(tenant.monthly_price_cents / 100).toFixed(0)}`
              : "$0"
          }
        />
      </div>
      <div style={storageBlock}>
        <div style={storageLine}>
          <span>STORAGE</span>
          <span>
            {formatBytes(tenant.storage_bytes)} of{" "}
            {formatBytes(storageLimit)}
          </span>
        </div>
        <div style={storageTrack}>
          <span style={{ ...storageFill, width: `${storagePercent}%` }} />
        </div>
      </div>
      <div style={lastActive}>
        Last activity {formatActivity(tenant.last_activity)}
      </div>
      <div style={actions}>
        <Link href={`/app/${tenant.slug}`} style={openLink}>
          Open app
        </Link>
        <Link
          href={`/request-change?tenant=${encodeURIComponent(tenant.slug)}`}
          style={secondaryLink}
        >
          Request a change
        </Link>
        {canManageTeam && (
          <Link href={`/app/${tenant.slug}?view=team`} style={secondaryLink}>
            Manage team
          </Link>
        )}
      </div>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={metricLabel}>{label.toUpperCase()}</div>
      <div style={metricValue}>{value}</div>
    </div>
  );
}

function planLabel(plan: string) {
  return plan === "custom" ? "Custom" : "Standard";
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(0, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatActivity(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "recently";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  }).format(date);
}

const header: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "14px 20px",
  borderBottom: `1px solid ${c.lineSoft}`,
};
const main: React.CSSProperties = {
  width: "min(1120px, 100%)",
  margin: "0 auto",
  padding: "48px 20px 90px",
  boxSizing: "border-box",
};
const titleRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  gap: 20,
  flexWrap: "wrap",
  marginBottom: 28,
};
const eyebrow: React.CSSProperties = {
  fontFamily: f.mono,
  fontSize: 12,
  letterSpacing: "0.1em",
  color: c.orangeDark,
  marginBottom: 8,
};
const heading: React.CSSProperties = {
  margin: 0,
  fontFamily: f.display,
  fontWeight: 900,
  fontSize: "clamp(34px, 6vw, 52px)",
  lineHeight: 1,
};
const intro: React.CSSProperties = {
  color: c.body,
  margin: "10px 0 0",
  fontSize: 17,
};
const primaryLink: React.CSSProperties = {
  display: "inline-block",
  background: c.orange,
  color: c.paper,
  textDecoration: "none",
  fontFamily: f.display,
  fontWeight: 800,
  padding: "13px 18px",
  borderRadius: 4,
};
const appGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 330px), 1fr))",
  gap: 16,
};
const appCard: React.CSSProperties = {
  minWidth: 0,
  background: c.paper,
  border: `1px solid ${c.line}`,
  borderRadius: 5,
  boxShadow: shadow.card,
  padding: 20,
};
const cardTop: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
};
const statusLabel: React.CSSProperties = {
  fontFamily: f.mono,
  fontSize: 10,
  letterSpacing: "0.09em",
  color: c.orangeDark,
  marginBottom: 4,
};
const cardTitle: React.CSSProperties = {
  fontFamily: f.display,
  fontSize: 24,
  lineHeight: 1.1,
  margin: 0,
};
const roleBadge: React.CSSProperties = {
  fontFamily: f.mono,
  fontSize: 9,
  letterSpacing: "0.08em",
  border: `1px solid ${c.line}`,
  borderRadius: 999,
  padding: "5px 8px",
  color: c.muted,
};
const metrics: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 14,
  marginTop: 22,
  paddingTop: 18,
  borderTop: `1px solid ${c.lineHair}`,
};
const metricLabel: React.CSSProperties = {
  fontFamily: f.mono,
  fontSize: 9,
  letterSpacing: "0.08em",
  color: c.muted,
};
const metricValue: React.CSSProperties = {
  fontFamily: f.display,
  fontSize: 18,
  fontWeight: 800,
  marginTop: 3,
};
const storageBlock: React.CSSProperties = { marginTop: 20 };
const storageLine: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  fontFamily: f.mono,
  fontSize: 9,
  letterSpacing: "0.06em",
  color: c.muted,
};
const storageTrack: React.CSSProperties = {
  height: 6,
  overflow: "hidden",
  borderRadius: 999,
  background: c.lineSoft,
  marginTop: 7,
};
const storageFill: React.CSSProperties = {
  display: "block",
  height: "100%",
  background: c.orange,
};
const lastActive: React.CSSProperties = {
  color: c.muted,
  fontSize: 12,
  marginTop: 14,
};
const actions: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginTop: 20,
};
const openLink: React.CSSProperties = {
  background: c.ink,
  color: c.paper,
  textDecoration: "none",
  fontWeight: 800,
  padding: "11px 14px",
  borderRadius: 4,
};
const secondaryLink: React.CSSProperties = {
  color: c.ink,
  textDecoration: "none",
  fontWeight: 700,
  padding: "10px 12px",
  border: `1px solid ${c.line}`,
  borderRadius: 4,
};
const emptyCard: React.CSSProperties = {
  maxWidth: 620,
  background: c.paper,
  border: `1px solid ${c.line}`,
  boxShadow: shadow.card,
  padding: "28px",
  borderRadius: 5,
};
const errorCard: React.CSSProperties = {
  ...emptyCard,
  color: c.red,
  background: "#FDECEA",
};
