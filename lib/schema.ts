import { c } from "@/lib/theme";
import type { Entry, TenantField } from "@/lib/types";

/**
 * The app shell is generated from `tenant_fields`, so these helpers are the
 * bridge between "whatever columns were in their spreadsheet" and the fixed
 * layout of the log card, the form and the dashboard.
 */

export function titleField(fields: TenantField[]): TenantField | undefined {
  return fields.find((f) => f.is_title) ?? fields[0];
}

export function statusField(fields: TenantField[]): TenantField | undefined {
  return fields.find((f) => f.is_status);
}

/** Secondary fields shown in the small mono line under a card's title. */
export function cardFields(fields: TenantField[]): TenantField[] {
  return fields.filter((f) => f.on_card && !f.is_title && !f.is_status);
}

/** Fields the log form asks for, in sheet order. */
export function formFields(fields: TenantField[]): TenantField[] {
  return [...fields].sort((a, b) => a.position - b.position);
}

const GREENISH =
  /^(returned|in|done|closed|complete|completed|available|paid|active|ok|yes|resolved)$/i;
const REDISH = /^(missing|lost|broken|overdue|damaged|cancelled|canceled|failed)$/i;

/**
 * A status pill for the log list. The design's mapping — OUT in orange, IN in
 * green, MISSING reversed out in red — generalises by meaning first, then by
 * position in the dropdown, so an unfamiliar sheet still colour-codes sensibly.
 */
export function statusTag(
  value: string | null | undefined,
  options: string[] = [],
): { label: string; color: string; filled: boolean } {
  const v = (value ?? "").trim();
  if (!v) return { label: "—", color: c.muted, filled: false };

  if (/^checked\s*out$/i.test(v)) return { label: "OUT", color: c.orangeDark, filled: false };
  if (/^returned$/i.test(v)) return { label: "IN", color: c.green, filled: false };
  if (REDISH.test(v)) return { label: v.toUpperCase(), color: c.red, filled: true };
  if (GREENISH.test(v)) return { label: v.toUpperCase(), color: c.green, filled: false };

  // Fall back to dropdown position: first choice reads as "open", last as
  // "problem", anything between as neutral.
  const i = options.findIndex((o) => o.toLowerCase() === v.toLowerCase());
  if (i === 0) return { label: shortLabel(v), color: c.orangeDark, filled: false };
  if (i > 0 && i === options.length - 1)
    return { label: shortLabel(v), color: c.red, filled: true };
  if (i > 0) return { label: shortLabel(v), color: c.green, filled: false };

  return { label: shortLabel(v), color: c.muted, filled: false };
}

function shortLabel(v: string) {
  const up = v.toUpperCase();
  return up.length <= 10 ? up : up.slice(0, 9) + "…";
}

/** Full-colour treatment for the big diagonal stamp on the detail screen. */
export function statusStampColor(
  value: string | null | undefined,
  options: string[] = [],
) {
  const t = statusTag(value, options);
  return t.color;
}

export function entryValue(entry: Entry, key: string): string {
  const v = entry.data?.[key];
  if (v === null || v === undefined || v === "") return "";
  return String(v);
}

/** "№0003 · Marcus · Hilldale" — the mono meta line on each card. */
export function cardMeta(
  entry: Entry,
  fields: TenantField[],
  prefix?: string,
): string {
  const parts = cardFields(fields)
    .map((f) => entryValue(entry, f.key))
    .filter(Boolean);
  return [prefix, ...parts].filter(Boolean).join(" · ");
}

const PLACEY =
  /(site|location|place|branch|store|room|shop|yard|truck|zone|region|dept|department|category|type|class|job)/i;

/**
 * Which dropdown the dashboard breaks entries down by.
 *
 * "By job site" tells an owner something they can act on; "by crew member" is
 * usually just a headcount. So prefer a column that names a place or a
 * category, and fall back to the last non-status dropdown.
 */
export function groupByField(fields: TenantField[]): TenantField | undefined {
  const candidates = cardFields(fields).filter(
    (x) => x.type === "dropdown" && x.options.length > 0,
  );
  if (candidates.length === 0) return undefined;
  return (
    candidates.find((x) => PLACEY.test(x.label)) ??
    candidates[candidates.length - 1]
  );
}

/** Blank form values for a tenant: defaults to the first dropdown option. */
export function emptyValues(fields: TenantField[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of fields) {
    if (f.type === "dropdown") out[f.key] = f.options[0] ?? "";
    else if (f.type === "date") out[f.key] = new Date().toISOString().slice(0, 10);
    else if (f.type === "boolean") out[f.key] = "no";
    else out[f.key] = "";
  }
  return out;
}

export function valuesFromEntry(
  entry: Entry,
  fields: TenantField[],
): Record<string, string> {
  const out = emptyValues(fields);
  for (const f of fields) {
    const v = entry.data?.[f.key];
    if (v !== undefined && v !== null) out[f.key] = String(v);
  }
  return out;
}

/** Required fields that are still blank — drives the disabled save button. */
export function missingRequired(
  values: Record<string, string>,
  fields: TenantField[],
): TenantField[] {
  return fields.filter((f) => f.required && !String(values[f.key] ?? "").trim());
}
