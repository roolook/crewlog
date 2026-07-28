import { supabaseAdmin } from "@/lib/supabase/admin";
import { c, f } from "@/lib/theme";
import { relative } from "@/lib/format";
import type { Tenant, TenantStatus } from "@/lib/types";

const GRID = "1.4fr 0.8fr 0.7fr 0.9fr 0.9fr 1.4fr 1fr";

const BADGE: Record<TenantStatus, { bg: string; fg: string }> = {
  active: { bg: c.greenBg, fg: c.green },
  preview: { bg: c.orangeBg, fg: c.orangeDark },
  churned: { bg: c.bg, fg: c.muted },
};

export default async function OpsTenantsPage() {
  const admin = supabaseAdmin();

  const { data: tenants } = await admin
    .from("tenants")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<(Tenant & { preview_token: string })[]>();

  const list = tenants ?? [];

  // One round trip each for the counts, then stitched in memory - cheaper than
  // a per-row query and accurate enough for an ops table.
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [{ data: memberRows }, { data: entryRows }] = await Promise.all([
    admin.from("tenant_members").select("tenant_id, status"),
    admin
      .from("entries")
      .select("tenant_id, created_at")
      .is("deleted_at", null)
      .gte("created_at", weekAgo),
  ]);

  const { data: lastActivity } = await admin
    .from("entries")
    .select("tenant_id, created_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(2000);

  const memberCount = tally((memberRows ?? []).filter((r) => r.status === "active"));
  const weekCount = tally(entryRows ?? []);
  const lastSeen = new Map<string, string>();
  for (const row of lastActivity ?? []) {
    if (!lastSeen.has(row.tenant_id)) lastSeen.set(row.tenant_id, row.created_at);
  }

  return (
    <div>
      <h1
        style={{
          fontFamily: f.display,
          fontWeight: 900,
          fontSize: 24,
          margin: "0 0 16px",
        }}
      >
        Tenants
      </h1>

      <div
        style={{
          background: c.paper,
          border: `1px solid ${c.line}`,
          borderRadius: 4,
          overflowX: "auto",
        }}
      >
        <div style={{ minWidth: 980 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: GRID,
              fontFamily: f.mono,
              fontSize: 11,
              color: c.muted,
              borderBottom: `2px solid ${c.ink}`,
              background: c.paperAlt,
            }}
          >
            {[
              "COMPANY",
              "STATUS",
              "MEMBERS",
              "ENTRIES / WK",
              "LAST ACTIVITY",
              "NOTES",
              "",
            ].map((h, i) => (
              <div key={i} style={{ padding: "9px 12px" }}>
                {h}
              </div>
            ))}
          </div>

          {list.map((t) => {
            const badge = BADGE[t.status];
            return (
              <div
                key={t.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: GRID,
                  fontSize: 13,
                  borderBottom: `1px solid ${c.lineFaint}`,
                  alignItems: "center",
                }}
              >
                <div style={{ padding: "11px 12px" }}>
                  <div style={{ fontWeight: 700 }}>{t.name}</div>
                  <div
                    style={{ fontFamily: f.mono, fontSize: 11, color: c.faint }}
                  >
                    {t.slug}
                  </div>
                </div>
                <div style={{ padding: "8px 12px" }}>
                  <span
                    style={{
                      fontFamily: f.mono,
                      fontSize: 10,
                      letterSpacing: "0.08em",
                      padding: "4px 8px",
                      borderRadius: 3,
                      background: badge.bg,
                      color: badge.fg,
                      border: "1px solid currentColor",
                    }}
                  >
                    {t.status.toUpperCase()}
                  </span>
                </div>
                <div
                  style={{ padding: "11px 12px", fontFamily: f.mono, fontSize: 12 }}
                >
                  {memberCount.get(t.id) ?? 0}
                </div>
                <div
                  style={{ padding: "11px 12px", fontFamily: f.mono, fontSize: 12 }}
                >
                  {weekCount.get(t.id) ?? 0}
                </div>
                <div
                  style={{
                    padding: "11px 12px",
                    fontFamily: f.mono,
                    fontSize: 12,
                    color: c.muted,
                  }}
                >
                  {relative(lastSeen.get(t.id) ?? null)}
                </div>
                <div
                  style={{
                    padding: "11px 12px",
                    color: c.muted,
                    fontStyle: "italic",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={t.notes ?? ""}
                >
                  {t.notes ?? "-"}
                </div>
                <div
                  style={{
                    padding: "11px 12px",
                    display: "flex",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <a
                    href={`/preview/${t.slug}?t=${t.preview_token}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontFamily: f.mono, fontSize: 11, color: c.muted }}
                  >
                    preview ↗
                  </a>
                  <a
                    href={`/app/${t.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontFamily: f.mono, fontSize: 11, color: c.muted }}
                  >
                    app ↗
                  </a>
                </div>
              </div>
            );
          })}

          {list.length === 0 && (
            <div
              style={{ padding: "60px 20px", textAlign: "center", color: c.muted }}
            >
              No tenants yet. Build one from the inbox.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function tally(rows: { tenant_id: string }[]) {
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.tenant_id, (m.get(r.tenant_id) ?? 0) + 1);
  return m;
}
