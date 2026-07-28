import type { TenantField } from "@/lib/types";

export const THEME_FIELD_KEY = "__app_theme";

export type AppTheme = {
  name: string;
  canvas: string;
  surface: string;
  ink: string;
  muted: string;
  border: string;
  accent: string;
  accentText: string;
  radius: 0 | 2 | 4 | 8;
};

export const DEFAULT_APP_THEME: AppTheme = {
  name: "CrewLog standard",
  canvas: "#EDEBE6",
  surface: "#FBFAF7",
  ink: "#17181B",
  muted: "#6E6C66",
  border: "#C9C6BD",
  accent: "#F4551E",
  accentText: "#FBFAF7",
  radius: 2,
};

const HEX = /^#[0-9a-f]{6}$/i;
const RADII = new Set([0, 2, 4, 8]);

export function parseAppTheme(value: unknown): AppTheme | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  const colors = [
    "canvas",
    "surface",
    "ink",
    "muted",
    "border",
    "accent",
    "accentText",
  ] as const;
  if (colors.some((key) => typeof source[key] !== "string" || !HEX.test(source[key]))) {
    return null;
  }
  const radius = Number(source.radius);
  if (!RADII.has(radius)) return null;

  return {
    name:
      typeof source.name === "string" && source.name.trim()
        ? source.name.trim().slice(0, 60)
        : "Custom theme",
    canvas: String(source.canvas).toUpperCase(),
    surface: String(source.surface).toUpperCase(),
    ink: String(source.ink).toUpperCase(),
    muted: String(source.muted).toUpperCase(),
    border: String(source.border).toUpperCase(),
    accent: String(source.accent).toUpperCase(),
    accentText: String(source.accentText).toUpperCase(),
    radius: radius as AppTheme["radius"],
  };
}

export function parseThemeResponse(raw: string): AppTheme | null {
  const trimmed = raw.trim();
  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  try {
    return parseAppTheme(JSON.parse(unfenced));
  } catch {
    const start = unfenced.indexOf("{");
    const end = unfenced.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try {
      return parseAppTheme(JSON.parse(unfenced.slice(start, end + 1)));
    } catch {
      return null;
    }
  }
}

export function themePrompt(input: {
  company: string;
  logLabel: string;
  fieldLabels: string[];
  inspiration: string;
}) {
  return `Design a restrained visual theme for a mobile field-work app.

PRODUCT
Company: ${input.company.trim() || "Unnamed company"}
App: ${input.logLabel.trim() || "Work log"}
Fields: ${input.fieldLabels.filter(Boolean).join(", ") || "Not decided yet"}

DESIGN INSPIRATION
${input.inspiration.trim() || "No reference supplied. Use the company's work and audience as the design basis."}

CONSTRAINTS
- This is used outdoors and in work vehicles. Prioritize legibility and strong contrast.
- Do not use gradients, glow, glass effects, purple by default, or decorative animation.
- The layout, typography, and component structure are fixed. Choose only the supported tokens.
- canvas and surface must be light enough for dark body text.
- accentText must be readable on accent.
- radius must be exactly 0, 2, 4, or 8.
- Return JSON only. No markdown, comments, or explanation.

OUTPUT SHAPE
{
  "name": "short descriptive name",
  "canvas": "#RRGGBB",
  "surface": "#RRGGBB",
  "ink": "#RRGGBB",
  "muted": "#RRGGBB",
  "border": "#RRGGBB",
  "accent": "#RRGGBB",
  "accentText": "#RRGGBB",
  "radius": 2
}`;
}

export function themeFromFields(fields: TenantField[]): {
  fields: TenantField[];
  theme: AppTheme;
} {
  const themeField = fields.find((field) => field.key === THEME_FIELD_KEY);
  const parsed = themeField?.options[0]
    ? parseThemeResponse(themeField.options[0])
    : null;
  return {
    fields: fields.filter((field) => field.key !== THEME_FIELD_KEY),
    theme: parsed ?? DEFAULT_APP_THEME,
  };
}
