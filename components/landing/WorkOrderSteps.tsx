import { c, f, shadow } from "@/lib/theme";
import { PromoSetupPrice } from "@/components/PromoSetupPrice";
import { WorkOrderStamp } from "@/components/landing/WorkOrderStamp";
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
        A real person turns your information into an app. We do not use a wizard
        or a generic template. Within 48 hours you get a link with your data
        already inside. Preview is free.
      </>
    ),
  },
  {
    n: "3 / TEAM LOGS.",
    stamp: "READY IN 48 HOURS",
    body: (
      <>
        Keep it: <PromoSetupPrice compact /> + $10/month with 25 GB of storage.
        That covers years of entries and photos. Invite your team by text. They
        log from their phones in under 10 seconds. No app store, no passwords.
      </>
    ),
  },
];

/** A carbon-copy work order: the process reads like a completed job ticket. */
export function WorkOrderSteps() {
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
            style={{
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
            <WorkOrderStamp delay={150 + i * 350}>{s.stamp}</WorkOrderStamp>
          </div>
        ))}
      </div>
    </div>
  );
}
