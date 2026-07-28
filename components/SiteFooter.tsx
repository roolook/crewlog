import Link from "next/link";
import { c, f } from "@/lib/theme";

export function SiteFooter() {
  return (
    <footer
      style={{
        maxWidth: 1100,
        margin: "0 auto",
        padding: "28px 20px 40px",
        display: "flex",
        flexWrap: "wrap",
        gap: 18,
        alignItems: "center",
        justifyContent: "space-between",
        fontFamily: f.mono,
        fontSize: 12,
        color: c.muted,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <div style={{ width: 10, height: 10, background: c.orange }} />
        <span
          style={{
            fontFamily: f.display,
            fontWeight: 900,
            color: c.ink,
            fontSize: 13,
          }}
        >
          CREWLOG
        </span>
      </div>
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
        <a href="mailto:build@crewlog.app" style={{ color: c.muted }}>
          build@crewlog.app
        </a>
        <Link href="/privacy" style={{ color: c.muted }}>
          privacy
        </Link>
        <Link href="/terms" style={{ color: c.muted }}>
          terms
        </Link>
        {/* The header drops this link under 640px for room; the footer is where
            a phone customer finds it. */}
        <Link href="/login" style={{ color: c.muted }}>
          customer login
        </Link>
      </div>
    </footer>
  );
}
