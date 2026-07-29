import { AppShell } from "@/components/app/AppShell";
import { demoBundle } from "@/lib/demo";

export const metadata = {
  title: "Sample Contracting Co. - Tool Log",
  robots: { index: false },
};

/**
 * The interactive demo embedded in the landing page's phone and the one linked
 * from "Try a live one". No auth, no database: state lives in the component,
 * so a visitor can add, edit and delete freely without touching anything real.
 */
export default async function DemoPage({
  searchParams,
}: {
  searchParams: Promise<{ brand?: string }>;
}) {
  const { brand } = await searchParams;
  return (
    <div style={{ height: "100dvh", overflow: "hidden" }}>
      <AppShell
        bundle={demoBundle(brand || undefined)}
        embedded
        requestChangeHref="/request-change?source=demo"
      />
    </div>
  );
}
