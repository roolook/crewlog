"use client";

import { useEffect, useRef, useState } from "react";
import { c, f, shadow, stamp } from "@/lib/theme";
import { dateStamp } from "@/lib/format";

const STEPS: { n: string; body: React.ReactNode; stamp: string }[] = [
  {
    n: "1 / SEND.",
    stamp: "RECEIVED",
    body: (
      <>
        Upload your spreadsheet or email it to{" "}
        <span
          style={{
            fontFamily: f.mono,
            fontSize: 14,
            background: c.bg,
            padding: "1px 5px",
          }}
        >
          build@crewlog.app
        </span>
        . Messy is fine. A photo of the whiteboard is fine.
      </>
    ),
  },
  {
    n: "2 / WE BUILD.",
    stamp: "IN BUILD",
    body: (
      <>
        A person — not a wizard, not a template — turns it into your app. Within
        48 hours you get a link with your data already inside. Preview is free.
      </>
    ),
  },
  {
    n: "3 / TEAM LOGS.",
    stamp: "READY — 48 HR",
    body: (
      <>
        Keep it: $99 setup + $10/month with 25 GB of storage — years of entries
        and photos. Invite your team by text. They log from their phones in under
        10 seconds. No app store, no passwords.
      </>
    ),
  },
];

/** A carbon-copy work order whose steps get rubber-stamped as you scroll past. */
export function WorkOrderSteps() {
  const [stamped, setStamped] = useState<Record<number, boolean>>({});
  const refs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setStamped({ 0: true, 1: true, 2: true });
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const i = refs.current.indexOf(e.target as HTMLDivElement);
          if (i < 0) continue;
          setTimeout(
            () => setStamped((s) => ({ ...s, [i]: true })),
            150 + i * 350,
          );
          io.unobserve(e.target);
        }
      },
      { threshold: 0.5 },
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div
      style={{
        background: c.paper,
        border: `1px solid ${c.line}`,
        borderRadius: 3,
        boxShadow: shadow.hairline2,
        display: "flex",
        overflow: "hidden",
      }}
    >
      {/* perforated stub */}
      <div
        style={{
          width: 26,
          flexShrink: 0,
          borderRight: `1px dashed ${c.line}`,
          backgroundImage:
            "radial-gradient(circle at 50% 50%, #E4E1D9 5px, transparent 5.5px)",
          backgroundSize: "100% 30px",
        }}
      />
      <div style={{ flex: 1, padding: "26px 26px 30px", minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            flexWrap: "wrap",
            gap: 8,
            borderBottom: `2px solid ${c.ink}`,
            paddingBottom: 12,
            marginBottom: 8,
          }}
        >
          <div
            style={{
              fontFamily: f.display,
              fontWeight: 900,
              fontSize: 24,
              letterSpacing: "0.01em",
            }}
          >
            WORK ORDER
          </div>
          <div style={{ fontFamily: f.mono, fontSize: 12, color: c.muted }}>
            Nº 0048 · {dateStamp()}
          </div>
        </div>

        {STEPS.map((s, i) => (
          <div
            key={s.n}
            ref={(el) => {
              refs.current[i] = el;
            }}
            style={{
              position: "relative",
              padding:
                i === STEPS.length - 1 ? "22px 8px 8px 0" : "22px 8px 20px 0",
              borderBottom:
                i === STEPS.length - 1
                  ? undefined
                  : `1px solid ${c.lineFaint}`,
            }}
          >
            <div
              style={{
                fontFamily: f.mono,
                fontSize: 12,
                color: c.orange,
                marginBottom: 6,
              }}
            >
              {s.n}
            </div>
            <p
              style={{
                margin: 0,
                fontSize: 16,
                lineHeight: 1.55,
                color: c.body,
                maxWidth: "30em",
              }}
            >
              {s.body}
            </p>
            <div
              style={stamp(!!stamped[i], c.orange, {
                top: 14,
                right: 0,
                fontSize: 18,
              })}
              aria-hidden
            >
              {s.stamp}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
