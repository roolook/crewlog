import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/supabase/server";
import { loadTenantBundle } from "@/lib/auth";
import { TenantApp } from "./TenantApp";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const bundle = await loadTenantBundle(slug);
  return {
    title: bundle ? `${bundle.tenant.name} — ${bundle.tenant.log_label}` : "CrewLog",
    robots: { index: false },
  };
}

export default async function TenantAppPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  if (!(await currentUser())) {
    redirect(`/login?next=${encodeURIComponent(`/app/${slug}`)}`);
  }

  const bundle = await loadTenantBundle(slug);
  // RLS makes "doesn't exist" and "not your tenant" the same answer, on purpose.
  if (!bundle) notFound();

  return (
    <div style={{ height: "100dvh", overflow: "hidden" }}>
      <TenantApp bundle={bundle} />
    </div>
  );
}
