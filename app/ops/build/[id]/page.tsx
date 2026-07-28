import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function BuildPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/ops/build?id=${encodeURIComponent(id)}`);
}
