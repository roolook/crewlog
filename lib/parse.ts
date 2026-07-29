import "server-only";
import * as XLSX from "xlsx";
import type { FieldType } from "@/lib/types";

/**
 * Turns whatever the customer sent into a proposed app schema.
 *
 * This is the operator's first 30 seconds of work done for them: find the header
 * row, guess each column's type, harvest dropdown options from the distinct
 * values, and pick the title and status columns. The operator then corrects it
 * in the schema editor - the guess only has to be close.
 */

export type ParsedColumn = {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  on_card: boolean;
  options: string[];
  is_title: boolean;
  is_status: boolean;
  /** How full the column is, 0–1. Sparse columns default to off-card. */
  fill: number;
};

export type ParsedSheet = {
  ok: true;
  sheetName: string;
  columns: ParsedColumn[];
  rows: Record<string, string>[];
  rowCount: number;
  /** Sheets beyond the first, which the operator may want to merge by hand. */
  otherSheets: string[];
};

export type ParseFailure = { ok: false; error: string };

const MAX_ROWS = 5000;
/** A column with this few distinct values, repeated, is a dropdown. */
const DROPDOWN_MAX_DISTINCT = 12;

export function parseSpreadsheet(
  buffer: ArrayBuffer,
  fileName: string,
  requestedSheet?: string,
): ParsedSheet | ParseFailure {
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buffer, { type: "array", cellDates: true });
  } catch (e) {
    return {
      ok: false,
      error: `Couldn't read ${fileName} - ${e instanceof Error ? e.message : "unsupported format"}. If it's a photo or PDF, type the columns in by hand.`,
    };
  }

  const sheetName =
    requestedSheet && wb.SheetNames.includes(requestedSheet)
      ? requestedSheet
      : wb.SheetNames[0];
  if (!sheetName) return { ok: false, error: "That file has no sheets in it." };

  const sheet = wb.Sheets[sheetName];
  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    blankrows: false,
    defval: "",
    raw: false,
  });

  if (grid.length === 0) return { ok: false, error: "That sheet is empty." };

  // Real-world sheets start with a title row, a blank row, a logo. The header is
  // the first row where most cells are non-empty short strings.
  const headerIndex = findHeaderRow(grid);
  const headerRow = (grid[headerIndex] ?? []).map((cell) => String(cell ?? "").trim());

  const used: Set<string> = new Set();
  const headers = headerRow.map((h, i) => {
    const label = h || `Column ${i + 1}`;
    let key = keyify(label);
    if (!key) key = `col_${i + 1}`;
    while (used.has(key)) key = `${key}_${i}`;
    used.add(key);
    return { label, key, index: i };
  });

  const bodyRows = grid
    .slice(headerIndex + 1)
    .filter((r) => r.some((cell) => String(cell ?? "").trim() !== ""))
    .slice(0, MAX_ROWS);

  const rows: Record<string, string>[] = bodyRows.map((r) => {
    const obj: Record<string, string> = {};
    for (const h of headers) obj[h.key] = String(r[h.index] ?? "").trim();
    return obj;
  });

  // Drop columns that are entirely empty - they're spreadsheet padding.
  const live = headers.filter((h) => rows.some((r) => r[h.key] !== ""));
  const columns: ParsedColumn[] = live.map((h) => {
    const values = rows.map((r) => r[h.key]).filter(Boolean);
    const distinct = Array.from(new Set(values));
    const fill = rows.length ? values.length / rows.length : 0;
    const type = inferType(h.label, values, distinct);

    return {
      key: h.key,
      label: h.label,
      type,
      required: fill > 0.95,
      on_card: fill > 0.5,
      options:
        type === "dropdown"
          ? distinct
              .sort((a, b) => count(values, b) - count(values, a))
              .slice(0, DROPDOWN_MAX_DISTINCT)
          : [],
      is_title: false,
      is_status: false,
      fill,
    };
  });

  markTitleAndStatus(columns, rows);

  return {
    ok: true,
    sheetName,
    columns,
    rows,
    rowCount: rows.length,
    otherSheets: wb.SheetNames.filter((name) => name !== sheetName),
  };
}

function count(list: string[], value: string) {
  return list.reduce((n, v) => (v === value ? n + 1 : n), 0);
}

function findHeaderRow(grid: unknown[][]) {
  const limit = Math.min(grid.length, 10);
  let best = 0;
  let bestScore = -1;
  for (let i = 0; i < limit; i++) {
    const cells = (grid[i] ?? []).map((cell) => String(cell ?? "").trim());
    const filled = cells.filter(Boolean);
    if (filled.length < 2) continue;
    // Headers are short, wordy, and rarely numeric.
    const score =
      filled.length -
      filled.filter((cell) => /^-?[\d.,$%]+$/.test(cell)).length * 2 -
      filled.filter((cell) => cell.length > 40).length;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

function keyify(label: string) {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

const DATEY = /(date|day|due|when|seen|updated|created|expir|renew|start|end)/i;
const NUMBERY = /(qty|quantity|count|amount|price|cost|total|hours|rate|number|#)/i;
const BOOLS = /^(yes|no|y|n|true|false|✓|x)$/i;

function inferType(
  label: string,
  values: string[],
  distinct: string[],
): FieldType {
  if (values.length === 0) return "text";

  if (distinct.length <= 2 && distinct.every((v) => BOOLS.test(v))) {
    return "boolean";
  }

  const dateHits = values.filter((v) => looksLikeDate(v)).length;
  if (dateHits / values.length > 0.7 || (DATEY.test(label) && dateHits > 0)) {
    return "date";
  }

  const numHits = values.filter((v) => /^-?[\d,]+(\.\d+)?$/.test(v.replace(/[$%\s]/g, ""))).length;
  if (numHits / values.length > 0.8 && (NUMBERY.test(label) || distinct.length > 4)) {
    return "number";
  }

  // Few distinct values, each used more than once → it was a dropdown all along.
  if (
    distinct.length > 1 &&
    distinct.length <= DROPDOWN_MAX_DISTINCT &&
    distinct.length < values.length / 1.5
  ) {
    return "dropdown";
  }

  return "text";
}

function looksLikeDate(v: string) {
  if (/^\d{1,4}[/-]\d{1,2}([/-]\d{1,4})?$/.test(v)) return true;
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return true;
  if (/^[A-Z][a-z]{2}\s+\d{1,2}/.test(v)) return true;
  return false;
}

const STATUSY = /(status|state|condition|stage|checked|availab)/i;

/**
 * The title column heads every log card; the status column drives the colours
 * and the dashboard's hero number. Pick them the way a person would: the
 * leftmost mostly-unique text column titles it, and a small dropdown whose name
 * or values sound like a status is the status.
 */
function markTitleAndStatus(
  columns: ParsedColumn[],
  rows: Record<string, string>[],
) {
  const title =
    columns.find(
      (col) =>
        col.type === "text" &&
        col.fill > 0.8 &&
        distinctRatio(col, rows) > 0.6,
    ) ??
    columns.find((col) => col.type === "text") ??
    columns[0];

  if (title) {
    title.is_title = true;
    title.required = true;
    title.on_card = false; // it *is* the card heading
  }

  const status =
    columns.find((col) => col.type === "dropdown" && STATUSY.test(col.label)) ??
    columns.find(
      (col) =>
        col.type === "dropdown" &&
        col.options.some((o) => STATUSY.test(o) || /^(in|out|open|closed|returned|missing)$/i.test(o)),
    ) ??
    columns.find((col) => col.type === "dropdown" && col.options.length <= 5);

  if (status && status !== title) {
    status.is_status = true;
    status.on_card = true;
    status.required = true;
  }
}

function distinctRatio(col: ParsedColumn, rows: Record<string, string>[]) {
  const values = rows.map((r) => r[col.key]).filter(Boolean);
  if (values.length === 0) return 0;
  return new Set(values).size / values.length;
}

/** Human summary for the ops header: "87 rows · 5 columns · 2 more sheets". */
export function parseSummary(p: ParsedSheet) {
  const bits = [
    `${p.rowCount} row${p.rowCount === 1 ? "" : "s"} parsed`,
    `${p.columns.length} columns`,
  ];
  if (p.otherSheets.length) {
    bits.push(
      `${p.otherSheets.length} more sheet${p.otherSheets.length === 1 ? "" : "s"} (${p.otherSheets.join(", ")})`,
    );
  }
  return bits.join(" · ");
}
