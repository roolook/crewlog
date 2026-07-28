import Link from "next/link";
import { Brand } from "@/components/Brand";
import { c, f } from "@/lib/theme";

export function SiteHeader({
  sticky = false,
  right,
}: {
  sticky?: boolean;
  right?: React.ReactNode;
}) {
  return (
    <header
      style={{
        position: sticky ? "sticky" : "static",
        top: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        padding: "12px 20px",
        background: sticky ? "rgba(237,235,230,0.92)" : "transparent",
        backdropFilter: sticky ? "blur(8px)" : undefined,
        borderBottom: `1px solid ${c.lineSoft}`,
      }}
    >
      <Brand />
      {right ?? (
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <Link
            href="/login"
            className="cl-link-muted"
            style={{ fontFamily: f.mono, fontSize: 12.5 }}
          >
            Customer login
          </Link>
          <Link
            href="/start"
            className="cl-btn-orange"
            style={{
              background: c.orange,
              color: c.paper,
              textDecoration: "none",
              fontFamily: f.display,
              fontWeight: 700,
              fontSize: 15,
              padding: "11px 18px",
              borderRadius: 4,
              whiteSpace: "nowrap",
            }}
          >
            Send my spreadsheet
          </Link>
        </div>
      )}
    </header>
  );
}
