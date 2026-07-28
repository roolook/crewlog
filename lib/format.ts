/** № 0048 - the work-order numbering used throughout the app. */
export function entryNo(n: number) {
  return "№" + String(n).padStart(4, "0");
}

/** WED, JUL 28 */
export function todayStamp(d = new Date()) {
  return d
    .toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    })
    .toUpperCase();
}

/** JUL 28, 2026 */
export function dateStamp(d = new Date()) {
  return d
    .toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
    .toUpperCase();
}

/** 7:42 AM */
export function timeOfDay(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * The log groups entries under TODAY / YESTERDAY / JUL 17 headings rather than
 * showing a date on every row - one glance tells you if the sheet is current.
 */
export function dayBucket(iso: string, now = new Date()) {
  const d = new Date(iso);
  const startOf = (x: Date) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(d)) / 86_400_000);
  if (days <= 0) return "TODAY";
  if (days === 1) return "YESTERDAY";
  return d
    .toLocaleDateString("en-US", { month: "short", day: "numeric" })
    .toUpperCase();
}

/** "Ready by Thursday" - the 48-hour promise, as a weekday name. */
export function readyDay(now = new Date()) {
  return new Date(now.getTime() + 48 * 3600 * 1000).toLocaleDateString("en-US", {
    weekday: "long",
  });
}

export function hoursAgo(iso: string, now = new Date()) {
  return Math.max(
    0,
    Math.round((now.getTime() - new Date(iso).getTime()) / 3_600_000),
  );
}

/** "yesterday", "2d ago", "7:41 AM" - compact recency for ops tables. */
export function relative(iso: string | null, now = new Date()) {
  if (!iso) return "-";
  const h = hoursAgo(iso, now);
  if (h < 24) return timeOfDay(iso);
  if (h < 48) return "yesterday";
  return Math.round(h / 24) + "d ago";
}

export function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/** RFC 4180 escaping, so exported sheets survive Excel. */
export function toCsv(rows: (string | number | null)[][]) {
  return rows
    .map((r) =>
      r
        .map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`)
        .join(","),
    )
    .join("\r\n");
}

export function siteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "http://localhost:3000"
  );
}
