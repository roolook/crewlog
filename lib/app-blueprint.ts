import {
  DEFAULT_APP_THEME,
  parseAppTheme,
  type AppTheme,
} from "@/lib/app-theme";

export const APP_BLUEPRINT_FIELD_KEY = "__app_blueprint";

export type AppBlueprint = {
  version: 1;
  appName: string;
  productSummary: string;
  theme: AppTheme;
  navigation: { label: string; purpose: string }[];
  workflows: {
    name: string;
    actor: string;
    steps: string[];
    successState: string;
  }[];
  permissions: { owner: string[]; crew: string[] };
  api: {
    resources: ("entries" | "members" | "files")[];
    webhookEvents: string[];
    integrations: string[];
  };
  files: { path: string; purpose: string; contents: string }[];
};

const SAFE_PATH = /^(app|components|lib)\/[a-zA-Z0-9_./\-[\]]+\.(tsx?|css|json)$/;

export function parseAppBlueprint(raw: string): AppBlueprint | null {
  const unfenced = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  let value: unknown;
  try {
    value = JSON.parse(unfenced);
  } catch {
    const start = unfenced.indexOf("{");
    const end = unfenced.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try {
      value = JSON.parse(unfenced.slice(start, end + 1));
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  const theme = parseAppTheme(source.theme);
  if (!theme || source.version !== 1) return null;
  if (!Array.isArray(source.files) || source.files.length === 0) return null;

  const files = source.files
    .filter((file): file is Record<string, unknown> => !!file && typeof file === "object")
    .map((file) => ({
      path: String(file.path ?? ""),
      purpose: String(file.purpose ?? "").slice(0, 500),
      contents: String(file.contents ?? ""),
    }));
  if (
    files.length === 0 ||
    files.reduce((sum, file) => sum + file.contents.length, 0) > 700_000 ||
    files.some(
      (file) =>
        !SAFE_PATH.test(file.path) ||
        file.path.includes("..") ||
        file.contents.length > 120_000,
    )
  ) {
    return null;
  }

  const navigation = Array.isArray(source.navigation)
    ? source.navigation.slice(0, 8).map((item) => {
        const row = item as Record<string, unknown>;
        return { label: String(row.label ?? ""), purpose: String(row.purpose ?? "") };
      })
    : [];
  const workflows = Array.isArray(source.workflows)
    ? source.workflows.slice(0, 12).map((item) => {
        const row = item as Record<string, unknown>;
        return {
          name: String(row.name ?? ""),
          actor: String(row.actor ?? ""),
          steps: Array.isArray(row.steps) ? row.steps.map(String).slice(0, 20) : [],
          successState: String(row.successState ?? ""),
        };
      })
    : [];
  const permissions =
    source.permissions && typeof source.permissions === "object"
      ? (source.permissions as Record<string, unknown>)
      : {};
  const api =
    source.api && typeof source.api === "object"
      ? (source.api as Record<string, unknown>)
      : {};
  const validResources = new Set(["entries", "members", "files"]);

  return {
    version: 1,
    appName: String(source.appName ?? "Customer app").slice(0, 100),
    productSummary: String(source.productSummary ?? "").slice(0, 1000),
    theme,
    navigation,
    workflows,
    permissions: {
      owner: Array.isArray(permissions.owner) ? permissions.owner.map(String) : [],
      crew: Array.isArray(permissions.crew) ? permissions.crew.map(String) : [],
    },
    api: {
      resources: Array.isArray(api.resources)
        ? api.resources
            .map(String)
            .filter((item): item is "entries" | "members" | "files" =>
              validResources.has(item),
            )
        : ["entries"],
      webhookEvents: Array.isArray(api.webhookEvents)
        ? api.webhookEvents.map(String).slice(0, 20)
        : [],
      integrations: Array.isArray(api.integrations)
        ? api.integrations.map(String).slice(0, 20)
        : [],
    },
    files,
  };
}

export function appBuildPrompt(input: {
  company: string;
  logLabel: string;
  fields: { key: string; label: string; type: string; required: boolean }[];
  inspiration: string;
  requests?: string[];
}) {
  return `You are the senior product designer and engineer responsible for a complete, production-quality CrewLog customer app. Do not return a theme. Design the whole app.

CUSTOMER
Company: ${input.company.trim() || "Unnamed company"}
Working app name: ${input.logLabel.trim() || "Work log"}
Existing data fields:
${input.fields.map((field) => `- ${field.key}: ${field.label} (${field.type}${field.required ? ", required" : ""})`).join("\n") || "- none yet"}
Customer requests:
${input.requests?.map((request) => `- ${request}`).join("\n") || "- none supplied"}

DESIGN AND PRODUCT INSPIRATION
${input.inspiration.trim() || "Use the customer's real work, environment, and users as the design basis."}

PLATFORM CONTRACT
- Next.js App Router, React 19, strict TypeScript, mobile first.
- The host supplies authenticated tenant data and these scoped operations: list/create/update/delete entries, invite/remove members, upload/download files.
- Never include Supabase credentials, service-role keys, database URLs, Clerk secrets, Stripe secrets, or any provider secret.
- External clients use /api/v1/{tenantSlug}/entries with a tenant API key. The key is tenant-scoped, rate limited, revocable, and storage-limited by CrewLog.
- Do not call Supabase directly. Do not invent another backend. Use the supplied api prop.
- Owner and crew permissions must be explicit.
- Include empty, loading, error, validation, offline/retry, and success states.
- Include accessibility labels and keyboard behavior.
- No gradients, glow, glass, decorative animation, fake metrics, fake testimonials, emojis as UI, or generic SaaS copy.
- Use an 8 point spacing system and one consistent component radius.
- The result must be usable by someone standing outdoors with one hand.

FILES
Return every app-specific file needed under app/, components/, or lib/. Include complete contents, imports, types, responsive behavior, and all states. Do not omit code with comments like "rest here". Do not include package.json, lockfiles, environment files, migrations, secrets, or generated assets.

OUTPUT
Return one JSON object only. No markdown or explanation.
{
  "version": 1,
  "appName": "specific app name",
  "productSummary": "what this app lets this customer do",
  "theme": {
    "name": "theme name",
    "canvas": "#RRGGBB",
    "surface": "#RRGGBB",
    "ink": "#RRGGBB",
    "muted": "#RRGGBB",
    "border": "#RRGGBB",
    "accent": "#RRGGBB",
    "accentText": "#RRGGBB",
    "radius": 2
  },
  "navigation": [{"label": "Today", "purpose": "specific purpose"}],
  "workflows": [{"name": "workflow", "actor": "owner or crew", "steps": ["step"], "successState": "visible result"}],
  "permissions": {"owner": ["capability"], "crew": ["capability"]},
  "api": {
    "resources": ["entries", "members", "files"],
    "webhookEvents": ["entry.created"],
    "integrations": []
  },
  "files": [
    {"path": "components/customer/CustomerApp.tsx", "purpose": "root app", "contents": "complete file contents"}
  ]
}`;
}

export const DEFAULT_APP_BLUEPRINT: AppBlueprint = {
  version: 1,
  appName: "CrewLog app",
  productSummary: "A focused mobile work log.",
  theme: DEFAULT_APP_THEME,
  navigation: [{ label: "Log", purpose: "View and update current work" }],
  workflows: [],
  permissions: { owner: ["manage entries", "manage crew"], crew: ["manage entries"] },
  api: { resources: ["entries"], webhookEvents: [], integrations: [] },
  files: [
    {
      path: "components/customer/CustomerApp.tsx",
      purpose: "Customer app root",
      contents: "// Uses the CrewLog AppShell contract.",
    },
  ],
};
