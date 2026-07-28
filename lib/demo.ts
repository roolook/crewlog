import type { TenantBundle } from "@/lib/types";
import type { AppTheme } from "@/lib/app-theme";

const DEMO_THEME: AppTheme = {
  name: "Field service ledger",
  canvas: "#EEF0EC",
  surface: "#FFFFFF",
  ink: "#14211D",
  muted: "#5B6761",
  border: "#BFC5BE",
  accent: "#D94D1F",
  accentText: "#FFFFFF",
  radius: 2,
};

/**
 * The tenant behind the landing page's "try a live one" phone. It runs entirely
 * in the browser with no auth and no database, so the demo is instant and can
 * never leak or mutate a real customer's log - but it is the same component
 * that serves real tenants, so what visitors touch is genuinely the product.
 */
export function demoBundle(brand = "Sample Contracting Co."): TenantBundle {
  const now = Date.now();
  const at = (hoursAgo: number) =>
    new Date(now - hoursAgo * 3_600_000).toISOString();

  const rows: [string, string, string, string, number][] = [
    ["DeWalt rotary hammer", "Marcus", "Hilldale Apartments", "Checked out", 2],
    ["Stihl MS 271 chainsaw", "Ray", "Oak Street cleanup", "Checked out", 5],
    ["Extension ladder 28″", "Denise", "Route 9 remodel", "Checked out", 21],
    ["DeWalt drill (20V)", "T.J.", "Main shop", "Returned", 27],
    ["Bosch laser level", "Marcus", "Route 9 remodel", "Checked out", 49],
    ["Wacker plate compactor", "Ray", "Hilldale Apartments", "Returned", 74],
    ["Milwaukee inspection camera", "Denise", "Oak Street cleanup", "Missing", 97],
    ["Hilti concrete saw", "T.J.", "Main shop", "Returned", 145],
  ];

  return {
    tenant: {
      id: "demo",
      slug: "demo",
      name: brand,
      log_label: "TOOL LOG",
      status: "active",
      owner_id: null,
      owner_name: "Sofia H.",
      owner_email: null,
      hero_label: "TOOLS CHECKED OUT RIGHT NOW",
      hero_field_key: "status",
      hero_field_value: "Checked out",
      source_file_name: "tools-2026.xlsx",
      source_row_count: 87,
      app_kind: "generated",
      custom_app_key: null,
      plan_tier: "standard",
      storage_limit_mb: 25600,
      billing_status: "active",
      monthly_price_cents: 1000,
      api_rate_limit_per_minute: 60,
      stripe_customer_id: null,
      stripe_subscription_id: null,
      current_period_start: null,
      current_period_end: null,
      notes: null,
      preview_expires_at: null,
      activated_at: at(24 * 120),
      created_at: at(24 * 120),
    },
    theme: DEMO_THEME,
    fields: [
      {
        id: "d1", tenant_id: "demo", key: "tool", label: "Tool", type: "text",
        required: true, on_card: false, options: [], is_title: true,
        is_status: false, position: 0,
      },
      {
        id: "d2", tenant_id: "demo", key: "who", label: "Assigned to",
        type: "dropdown", required: true, on_card: true,
        options: ["Marcus", "Ray", "Denise", "T.J."], is_title: false,
        is_status: false, position: 1,
      },
      {
        id: "d3", tenant_id: "demo", key: "site", label: "Job site",
        type: "dropdown", required: true, on_card: true,
        options: ["Hilldale Apartments", "Oak Street cleanup", "Route 9 remodel", "Main shop"], is_title: false,
        is_status: false, position: 2,
      },
      {
        id: "d4", tenant_id: "demo", key: "status", label: "Status",
        type: "dropdown", required: true, on_card: true,
        options: ["Checked out", "Returned", "Missing"], is_title: false,
        is_status: true, position: 3,
      },
    ],
    entries: rows.map(([tool, who, site, status, hours], i) => ({
      id: `demo-${i + 1}`,
      tenant_id: "demo",
      entry_no: rows.length - i,
      data: { tool, who, site, status },
      title: tool,
      status_value: status,
      occurred_on: null,
      created_by: null,
      created_by_name: who,
      deleted_at: null,
      created_at: at(hours),
      updated_at: at(hours),
    })),
    members: [
      {
        id: "m0", tenant_id: "demo", user_id: null, display_name: "Sofia H.",
        email: null, phone: null, role: "owner", status: "active",
        invite_token: null, last_log_at: at(3), joined_at: at(24 * 120),
      },
      ...["Marcus", "Ray", "Denise", "T.J."].map((n, i) => ({
        id: `m${i + 1}`,
        tenant_id: "demo",
        user_id: null,
        display_name: n,
        email: null,
        phone: null,
        role: "crew" as const,
        status: "active" as const,
        invite_token: null,
        last_log_at: at(4 + i * 20),
        joined_at: at(24 * 110),
      })),
    ],
    viewerRole: "owner",
    viewerName: "Sofia H.",
  };
}
