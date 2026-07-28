import type { FieldType, FieldValue, LocationValue, FileValue } from "@/lib/types";

/**
 * Reading and writing the richer field types.
 *
 * The five inferred types (text, number, date, dropdown, boolean) hold scalars.
 * The opt-in capability types hold objects — a pin has a lat and a lng, a photo
 * has a storage path — so everything that touches `entries.data` needs to know
 * which shape it's looking at. These helpers are that knowledge, in one place.
 */

/** Types whose value is an object rather than a scalar. */
const OBJECT_TYPES: FieldType[] = ["location", "photo", "signature"];

export function isObjectField(type: FieldType) {
  return OBJECT_TYPES.includes(type);
}

/** Types the parser never infers — an operator assigns them deliberately. */
export function isCapabilityField(type: FieldType) {
  return (
    type === "location" ||
    type === "photo" ||
    type === "signature" ||
    type === "barcode" ||
    type === "rating" ||
    type === "currency" ||
    type === "long_text"
  );
}

export function asLocation(v: FieldValue): LocationValue | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const lat = Number(o.lat);
  const lng = Number(o.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return {
    lat,
    lng,
    label: typeof o.label === "string" ? o.label : undefined,
  };
}

export function asFile(v: FieldValue): FileValue | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (typeof o.path !== "string" || !o.path) return null;
  return {
    path: o.path,
    width: Number.isFinite(Number(o.width)) ? Number(o.width) : undefined,
    height: Number.isFinite(Number(o.height)) ? Number(o.height) : undefined,
  };
}

/** 6 decimal places is ~10cm — more is false precision from a phone GPS. */
export function formatCoords(loc: LocationValue) {
  return `${loc.lat.toFixed(6)}, ${loc.lng.toFixed(6)}`;
}

/**
 * A deep link that opens the platform's own map app. This is what makes the
 * location field useful even with no tile provider configured: the pin is still
 * captured, and "Open in Maps" hands it to software the phone already has.
 */
export function mapsUrl(loc: LocationValue) {
  const q = `${loc.lat},${loc.lng}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

/** One-line rendering for a log card, a detail row or a CSV cell. */
export function displayValue(type: FieldType, v: FieldValue): string {
  if (v === null || v === undefined || v === "") return "";

  switch (type) {
    case "location": {
      const loc = asLocation(v);
      if (!loc) return "";
      return loc.label ? `${loc.label} (${formatCoords(loc)})` : formatCoords(loc);
    }
    case "photo":
    case "signature": {
      const file = asFile(v);
      return file ? (type === "photo" ? "photo attached" : "signed") : "";
    }
    case "currency": {
      const n = Number(v);
      return Number.isFinite(n)
        ? n.toLocaleString("en-US", { style: "currency", currency: "USD" })
        : String(v);
    }
    case "boolean":
      return v === true || v === "yes" || v === "true" ? "Yes" : "No";
    case "rating":
      return String(v);
    default:
      return String(v);
  }
}

/** Is this field filled in? `required` checks can't just test for truthiness. */
export function hasValue(type: FieldType, v: FieldValue): boolean {
  if (v === null || v === undefined || v === "") return false;
  if (type === "location") return asLocation(v) !== null;
  if (type === "photo" || type === "signature") return asFile(v) !== null;
  if (type === "boolean") return true; // false is an answer
  return String(v).trim() !== "";
}

/**
 * Coerce a submitted value to the field's storage shape, or null.
 *
 * Used server-side in the entry actions — never trust the client to have sent
 * the right shape, and never store a half-formed pin.
 */
export function coerceValue(
  type: FieldType,
  raw: unknown,
  options: string[] = [],
): FieldValue {
  if (raw === null || raw === undefined || raw === "") return null;

  switch (type) {
    case "location": {
      const parsed = typeof raw === "string" ? safeParse(raw) : raw;
      return asLocation(parsed as FieldValue);
    }
    case "photo":
    case "signature": {
      const parsed = typeof raw === "string" ? safeParse(raw) : raw;
      const file = asFile(parsed as FieldValue);
      // Paths must stay inside the entry-photos namespace we control.
      if (!file || file.path.includes("..") || file.path.startsWith("/")) {
        return null;
      }
      return file;
    }
    case "number":
    case "currency": {
      const n = Number(String(raw).replace(/[^0-9.\-]/g, ""));
      return Number.isFinite(n) ? n : null;
    }
    case "rating": {
      const s = String(raw).trim();
      if (options.length > 0) return options.includes(s) ? s : null;
      const n = Math.round(Number(s));
      return Number.isFinite(n) && n >= 0 && n <= 5 ? n : null;
    }
    case "boolean":
      return /^(yes|true|1|on)$/i.test(String(raw).trim());
    case "dropdown": {
      const s = String(raw).trim();
      if (options.length === 0) return s.slice(0, 500);
      return options.includes(s) ? s : null;
    }
    case "long_text":
      return String(raw).trim().slice(0, 4000);
    case "barcode":
      return String(raw).trim().slice(0, 200);
    default:
      return String(raw).trim().slice(0, 500);
  }
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

/** True when the tenant uses a map anywhere — gates loading MapLibre at all. */
export function needsMap(fields: { type: FieldType }[]) {
  return fields.some((f) => f.type === "location");
}

export function hasMapTiles() {
  return !!process.env.NEXT_PUBLIC_MAPTILER_KEY;
}
