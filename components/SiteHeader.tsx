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
        background: sticky ? c.bg : "transparent",
        borderBottom: `1px solid ${c.lineSoft}`,
      }}
    >
      <Brand />
      {right ?? (
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {/* Hidden under 640px: at 375 there isn't room for the brand, this,
              and the CTA, so it used to wrap to two ragged lines. The footer
              carries the same link for phones. */}
          <Link
            href="/app"
            className="cl-link-muted cl-hide-sm"
            style={{ fontFamily: f.mono, fontSize: 12, whiteSpace: "nowrap" }}
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
              fontSize: 16,
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
