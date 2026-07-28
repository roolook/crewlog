import { NextResponse, type NextRequest } from "next/server";
import { loadTenantBundle } from "@/lib/auth";
import { entryNo, toCsv } from "@/lib/format";
import { entryValue, formFields } from "@/lib/schema";

/**
 * "Cancel anytime. You get a full CSV of everything within a day." - this is
 * that, available instantly. RLS decides whether the caller may see the tenant,
 * so no extra authorisation check is needed here beyond loading the bundle.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const bundle = await loadTenantBundle(slug);
  if (!bundle) return new NextResponse("Not found", { status: 404 });

  const cols = formFields(bundle.fields);
  const rows: (string | number | null)[][] = [
    ["Entry", ...cols.map((f) => f.label), "Logged by", "Logged at"],
    ...bundle.entries.map((e) => [
      entryNo(e.entry_no),
      ...cols.map((f) => entryValue(e, f.key)),
      e.created_by_name ?? "",
      new Date(e.created_at).toISOString(),
    ]),
  ];

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse("﻿" + toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}-log-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
