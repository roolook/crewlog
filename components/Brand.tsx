import Link from "next/link";
import { c, f } from "@/lib/theme";

/** The orange square + CREWLOG wordmark. */
export function Brand({
  size = 19,
  href = "/",
  color = c.ink,
}: {
  size?: number;
  href?: string | null;
  color?: string;
}) {
  const dot = Math.round(size * 0.74);
  const inner = (
    <>
      <div
        style={{
          width: dot,
          height: dot,
          background: c.orange,
          flexShrink: 0,
        }}
      />
      <div
        style={{
          fontFamily: f.display,
          fontWeight: 900,
          fontSize: size,
          letterSpacing: "0.02em",
          color,
        }}
      >
        CREWLOG
      </div>
    </>
  );

  const style: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 9,
    textDecoration: "none",
  };

  if (!href) return <div style={style}>{inner}</div>;
  return (
    <Link href={href} style={style}>
      {inner}
    </Link>
  );
}
