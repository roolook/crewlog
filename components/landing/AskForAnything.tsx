import Link from "next/link";
import { Arrow, Check } from "@/components/Icon";
import { c, f } from "@/lib/theme";
import { CAPABILITIES } from "@/lib/capabilities";

/**
 * "We can build anything" is marketing noise. "Tap Location, drop a pin" is a
 * product. So this section lists the actual capabilities, in the customer's
 * words, straight from the same catalogue the intake form ticks - one source of
 * truth means the site can never promise something the form doesn't offer.
 *
 * The closing line does the honest work: anything not on the list gets a yes or
 * a no, not a maybe.
 */
export function AskForAnything() {
  const listed = CAPABILITIES.filter((cap) => cap.id !== "something_else");

  return (
    <div>
      <h2
        style={{
          fontFamily: f.display,
          fontWeight: 900,
          fontSize: "clamp(26px, 3.6vw, 38px)",
          lineHeight: 1.08,
          margin: "0 0 14px",
          maxWidth: "24em",
        }}
      >
        A log is just the simplest thing we build.
      </h2>
      <p
        style={{
          fontSize: 18,
          lineHeight: 1.55,
          color: c.body,
          margin: "0 0 30px",
          maxWidth: "38em",
          textWrap: "pretty",
        }}
      >
        Tell us what the app should do and it gets built in. These are the things
        people ask for most - you tick them on the form, we do the rest.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: 1,
          background: c.line,
          border: `1px solid ${c.line}`,
          borderRadius: 4,
          overflow: "hidden",
        }}
      >
        {listed.map((cap) => (
          <div
            key={cap.id}
            style={{
              background: c.paper,
              padding: "16px 18px",
              display: "flex",
              gap: 10,
              alignItems: "flex-start",
            }}
          >
            <Check color={c.orange} size={14} style={{ marginTop: 4 }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{cap.label}</div>
              <div
                style={{
                  fontSize: 14,
                  color: c.muted,
                  lineHeight: 1.45,
                  marginTop: 3,
                }}
              >
                {cap.detail}
              </div>
            </div>
          </div>
        ))}
      </div>

      <p
        style={{
          fontSize: 18,
          lineHeight: 1.55,
          color: c.body,
          margin: "26px 0 0",
          maxWidth: "34em",
        }}
      >
        Want something that isn&apos;t on this list? Describe it on the form.{" "}
        <strong>
          You&apos;ll get a straight yes or no within 48 hours
        </strong>{" "}
        - not a maybe, and not a sales call.{" "}
        <Link
          href="/start"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            fontWeight: 600,
          }}
        >
          Send the sheet
          <Arrow size={13} />
        </Link>
      </p>
    </div>
  );
}
