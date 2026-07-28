import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type Context = { params: Promise<{ slug: string }> };

export async function GET(request: NextRequest, context: Context) {
  const auth = await authorize(request, context);
  if (!auth.ok) return auth.response;

  const limit = Math.min(
    Math.max(Number(request.nextUrl.searchParams.get("limit") ?? 100), 1),
    500,
  );
  const { data, error } = await supabaseAdmin()
    .from("entries")
    .select("id, entry_no, title, status_value, occurred_on, data, created_at, updated_at")
    .eq("tenant_id", auth.tenant.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  const status = error ? 500 : 200;
  await recordUsage(auth.tenant.id, auth.keyId, "entries", "GET", status);
  return error
    ? NextResponse.json({ error: "Entries could not be loaded." }, { status })
    : NextResponse.json({ data, limit });
}

export async function POST(request: NextRequest, context: Context) {
  const auth = await authorize(request, context);
  if (!auth.ok) return auth.response;

  let body: { data?: Record<string, unknown>; title?: string; status?: string };
  try {
    body = await request.json();
  } catch {
    await recordUsage(auth.tenant.id, auth.keyId, "entries", "POST", 400);
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  if (!body.data || typeof body.data !== "object" || Array.isArray(body.data)) {
    await recordUsage(auth.tenant.id, auth.keyId, "entries", "POST", 422);
    return NextResponse.json({ error: "data must be a JSON object." }, { status: 422 });
  }

  const { data, error } = await supabaseAdmin()
    .from("entries")
    .insert({
      tenant_id: auth.tenant.id,
      data: body.data,
      title: String(body.title ?? "").slice(0, 300),
      status_value: body.status ? String(body.status).slice(0, 100) : null,
      created_by_name: `API: ${auth.keyName}`,
    })
    .select("id, entry_no, title, status_value, data, created_at")
    .single();

  const status = error ? 500 : 201;
  await recordUsage(auth.tenant.id, auth.keyId, "entries", "POST", status);
  return error
    ? NextResponse.json({ error: "Entry could not be created." }, { status })
    : NextResponse.json({ data }, { status });
}

async function authorize(request: NextRequest, context: Context): Promise<
  | {
      ok: true;
      tenant: { id: string; api_rate_limit_per_minute: number };
      keyId: string;
      keyName: string;
    }
  | { ok: false; response: NextResponse }
> {
  const { slug } = await context.params;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token?.startsWith("cl_live_")) {
    return {
      ok: false,
      response: NextResponse.json({ error: "A tenant API key is required." }, { status: 401 }),
    };
  }
  const admin = supabaseAdmin();
  const hash = createHash("sha256").update(token).digest("hex");
  const { data: key } = await admin
    .from("tenant_api_keys")
    .select("id, tenant_id, name, revoked_at")
    .eq("key_hash", hash)
    .maybeSingle();
  if (!key || key.revoked_at) {
    return {
      ok: false,
      response: NextResponse.json({ error: "That API key is invalid or revoked." }, { status: 401 }),
    };
  }
  const { data: tenant } = await admin
    .from("tenants")
    .select("id, slug, status, api_rate_limit_per_minute")
    .eq("id", key.tenant_id)
    .eq("slug", slug)
    .maybeSingle();
  if (!tenant || tenant.status === "churned") {
    return {
      ok: false,
      response: NextResponse.json({ error: "Tenant access is unavailable." }, { status: 403 }),
    };
  }

  const since = new Date(Date.now() - 60_000).toISOString();
  const { count } = await admin
    .from("tenant_api_usage")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenant.id)
    .gte("occurred_at", since);
  if ((count ?? 0) >= tenant.api_rate_limit_per_minute) {
    await recordUsage(tenant.id, key.id, "entries", request.method, 429);
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Tenant rate limit exceeded.", retryAfterSeconds: 60 },
        { status: 429, headers: { "Retry-After": "60" } },
      ),
    };
  }

  await admin
    .from("tenant_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", key.id);
  return { ok: true, tenant, keyId: key.id, keyName: key.name };
}

async function recordUsage(
  tenantId: string,
  keyId: string,
  route: string,
  method: string,
  statusCode: number,
) {
  await supabaseAdmin().from("tenant_api_usage").insert({
    tenant_id: tenantId,
    api_key_id: keyId,
    route,
    method,
    status_code: statusCode,
  });
}
