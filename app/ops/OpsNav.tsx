"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { c, f } from "@/lib/theme";

const TABS: [string, string][] = [
  ["INBOX", "/ops"],
  ["TENANTS", "/ops/tenants"],
  ["CHANGES", "/ops/changes"],
  ["EMAILS", "/ops/emails"],
];

export function OpsNav() {
  const path = usePathname();

  return (
    <nav style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
      {TABS.map(([label, href]) => {
        const active = href === "/ops" ? path === "/ops" : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className="cl-ops-tab"
            style={{
              background: active ? c.orange : "transparent",
              color: active ? c.paper : c.line,
              textDecoration: "none",
              fontFamily: f.mono,
              fontSize: 12,
              letterSpacing: "0.06em",
              padding: "8px 12px",
              borderRadius: 3,
            }}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
