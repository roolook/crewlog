import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { c, f } from "@/lib/theme";
import type { IntakeSubmission } from "@/lib/types";
import { SchemaEditor } from "./[id]/SchemaEditor";
import { ExistingBuild } from "./ExistingBuild";

export const dynamic = "force-dynamic";

export default async function BuildWorkbenchPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;

  if (!id) {
    return (
      <BuildNotice
        title="Choose a build from the inbox."
        detail="The build workbench needs an intake submission."
      />
    );
  }

  const { data, error } = await supabaseAdmin()
    .from("intake_submissions")
    .select("*")
    .eq("id", id)
    .maybeSingle<IntakeSubmission>();

  if (error) {
    console.error("Build submission lookup failed", { id, message: error.message });
    return (
      <BuildNotice
        title="The build could not load."
        detail={error.message}
      />
    );
  }

  if (!data) {
    return (
      <BuildNotice
        title="That intake submission is no longer available."
        detail="Return to the inbox and choose a current submission."
      />
    );
  }

  if (data.tenant_id) {
    const { data: tenant, error: tenantError } = await supabaseAdmin()
      .from("tenants")
      .select("name, slug, preview_token, source_row_count")
      .eq("id", data.tenant_id)
      .maybeSingle();

    if (tenantError) {
      return (
        <BuildNotice
          title="The existing build could not load."
          detail={tenantError.message}
        />
      );
    }

    if (tenant) {
      const { data: apiKeys } = await supabaseAdmin()
        .from("tenant_api_keys")
        .select("id, name, key_prefix, last_used_at, revoked_at, created_at")
        .eq("tenant_id", data.tenant_id)
        .order("created_at", { ascending: false });
      const previewUrl =
        `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}` +
        `/preview/${tenant.slug}?t=${tenant.preview_token}`;
      return (
        <ExistingBuild
          submissionId={data.id}
          tenantId={data.tenant_id}
          customerEmail={data.email}
          companyName={tenant.name}
          slug={tenant.slug}
          previewUrl={previewUrl}
          imported={tenant.source_row_count}
          status={data.status}
          previewSentAt={data.preview_sent_at}
          deliveryError={data.delivery_error}
          apiKeys={apiKeys ?? []}
        />
      );
    }
  }

  return <SchemaEditor submission={data} />;
}

function BuildNotice({ title, detail }: { title: string; detail: string }) {
  return (
    <div
      role="alert"
      style={{
        maxWidth: 620,
        background: c.paper,
        border: `1px solid ${c.line}`,
        borderRadius: 4,
        padding: "24px 26px",
      }}
    >
      <h1
        style={{
          margin: "0 0 8px",
          fontFamily: f.display,
          fontSize: 24,
          fontWeight: 900,
        }}
      >
        {title}
      </h1>
      <p style={{ margin: "0 0 18px", color: c.muted, lineHeight: 1.5 }}>
        {detail}
      </p>
      <Link
        href="/ops"
        style={{
          display: "inline-block",
          background: c.ink,
          color: c.paper,
          borderRadius: 3,
          padding: "10px 14px",
          fontFamily: f.mono,
          fontSize: 12,
          textDecoration: "none",
        }}
      >
        Back to inbox
      </Link>
    </div>
  );
}
