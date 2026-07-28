import { c, f } from "@/lib/theme";

export default function OpsLoading() {
  return (
    <div
      aria-live="polite"
      style={{
        maxWidth: 720,
        background: c.paper,
        border: `1px solid ${c.line}`,
        borderRadius: 4,
        padding: "22px 24px",
        fontFamily: f.mono,
        fontSize: 12,
        color: c.muted,
      }}
    >
      Loading operator data...
    </div>
  );
}
