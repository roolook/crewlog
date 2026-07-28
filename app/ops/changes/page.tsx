import { supabaseAdmin } from "@/lib/supabase/admin";
import { c, f } from "@/lib/theme";
import { relative } from "@/lib/format";
import { ChangeRow } from "./ChangeRow";

export const dynamic = "force-dynamic";

export default async function OpsChangesPage() {
  const { data } = await supabaseAdmin()
    .from("change_requests")
    .select("*, tenants(name, slug)")
    .order("done")
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = data ?? [];

  return (
    <div>
      <h1
        style={{
          fontFamily: f.display,
          fontWeight: 900,
          fontSize: 24,
          margin: "0 0 4px",
        }}
      >
        Change requests
      </h1>
      <div
        style={{
          fontFamily: f.mono,
          fontSize: 12,
          color: c.muted,
          marginBottom: 16,
        }}
      >
        fed from request-a-change emails · promise: done within a day
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          maxWidth: 760,
        }}
      >
        {rows.map((r) => {
          const tenant = Array.isArray(r.tenants) ? r.tenants[0] : r.tenants;
          return (
            <ChangeRow
              key={r.id}
              id={r.id}
              text={r.body}
              done={r.done}
              meta={[
                r.requester,
                tenant?.slug ?? "unassigned",
                relative(r.created_at),
              ].join(" · ")}
            />
          );
        })}

        {rows.length === 0 && (
          <div
            style={{
              background: c.paper,
              border: `1px solid ${c.line}`,
              borderRadius: 4,
              padding: "40px 20px",
              textAlign: "center",
              color: c.muted,
            }}
          >
            Nothing outstanding.
          </div>
        )}
      </div>
    </div>
  );
}
