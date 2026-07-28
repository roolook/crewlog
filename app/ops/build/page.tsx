import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { c, f } from "@/lib/theme";
import type { IntakeSubmission } from "@/lib/types";
import { SchemaEditor } from "./[id]/SchemaEditor";

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
