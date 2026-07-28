import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { Arrow } from "@/components/Icon";
import { c, f } from "@/lib/theme";
import { hoursAgo } from "@/lib/format";
import type { IntakeSubmission } from "@/lib/types";

const COLS = "1.4fr 1fr 1.4fr 1.6fr 0.9fr 0.8fr";

/** The intake inbox: oldest first, because the 48-hour clock is the promise. */
export default async function OpsInboxPage() {
  const { data } = await supabaseAdmin()
    .from("intake_submissions")
    .select("*")
    .in("status", ["queued", "building"])
    .order("created_at", { ascending: true })
    .returns<IntakeSubmission[]>();

  const inbox = data ?? [];

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 14,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <h1
          style={{
            fontFamily: f.display,
            fontWeight: 900,
            fontSize: 24,
            margin: 0,
          }}
        >
          Intake inbox
        </h1>
        <div style={{ fontFamily: f.mono, fontSize: 12, color: c.muted }}>
          {inbox.length} in queue · oldest first
        </div>
      </div>

      <div
        style={{
          background: c.paper,
          border: `1px solid ${c.line}`,
          borderRadius: 4,
          overflowX: "auto",
        }}
      >
        <div style={{ minWidth: 900 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: COLS,
              fontFamily: f.mono,
              fontSize: 11,
              color: c.muted,
              borderBottom: `2px solid ${c.ink}`,
              background: c.paperAlt,
            }}
          >
            {["FILE", "NAME", "EMAIL", "NOTES", "AGE / 48H", ""].map((h, i) => (
              <div key={i} style={{ padding: "9px 12px" }}>
                {h}
              </div>
            ))}
          </div>

          {inbox.map((r) => {
            const age = hoursAgo(r.created_at);
            const late = age > 36;
            return (
              <div
                key={r.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: COLS,
                  fontSize: 13,
                  borderBottom: `1px solid ${c.lineFaint}`,
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    padding: "11px 12px",
                    fontFamily: f.mono,
                    fontSize: 12,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={r.file_name ?? ""}
                >
                  {r.file_name ?? (r.by_email ? "(coming by email)" : "-")}
                </div>
                <div style={{ padding: "11px 12px", fontWeight: 600 }}>
                  {r.name}
                </div>
                <div
                  style={{
                    padding: "11px 12px",
                    fontFamily: f.mono,
                    fontSize: 12,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={r.email}
                >
                  {r.email}
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
                  title={r.notes ?? ""}
                >
                  {r.notes ?? "-"}
                </div>
                <div
                  style={{
                    padding: "11px 12px",
                    fontFamily: f.mono,
                    fontSize: 12,
                    fontWeight: late ? 700 : 500,
                    color: late ? c.orange : c.body,
                  }}
                >
                  {age}h
                </div>
                <div style={{ padding: "8px 12px" }}>
                  <Link
                    href={`/ops/build?id=${encodeURIComponent(r.id)}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      background: c.ink,
                      color: c.paper,
                      textDecoration: "none",
                      fontFamily: f.mono,
                      fontSize: 11,
                      padding: "8px 12px",
                      borderRadius: 3,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {r.tenant_id ? "VIEW" : "BUILD"}
                    <Arrow size={11} />
                  </Link>
                </div>
              </div>
            );
          })}

          {inbox.length === 0 && (
            <div
              style={{
                padding: "60px 20px",
                textAlign: "center",
                color: c.muted,
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 600, color: c.body }}>
                Queue&apos;s empty.
              </div>
              <div style={{ fontSize: 14, marginTop: 6 }}>
                Every build is out the door.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
