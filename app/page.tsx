import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { HeroAnimation } from "@/components/landing/HeroAnimation";
import { LossCalculator } from "@/components/landing/LossCalculator";
import { Faq } from "@/components/landing/Faq";
import { StickyCta } from "@/components/landing/StickyCta";
import { WorkOrderSteps } from "@/components/landing/WorkOrderSteps";
import { PhoneFrame } from "@/components/PhoneFrame";
import { c, f, shadow } from "@/lib/theme";
import { readyDay } from "@/lib/format";

const SETUP = process.env.NEXT_PUBLIC_SETUP_FEE ?? "99";
const MONTHLY = process.env.NEXT_PUBLIC_MONTHLY_FEE ?? "10";

export default function LandingPage() {
  const ready = readyDay();

  return (
    <>
      <SiteHeader sticky />

      {/* ── hero ──────────────────────────────────────────────────────────── */}
      <section
        data-hero
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "64px 20px 28px",
          display: "flex",
          flexWrap: "wrap",
          gap: 48,
          alignItems: "flex-start",
        }}
      >
        <div style={{ flex: "1 1 400px", minWidth: 300 }}>
          <div
            style={{
              fontFamily: f.mono,
              fontSize: 13,
              letterSpacing: "0.12em",
              color: c.muted,
              marginBottom: 18,
            }}
          >
            FOR ANYONE WHO RUNS ON A SPREADSHEET
          </div>
          <h1
            style={{
              fontFamily: f.display,
              fontWeight: 900,
              fontSize: "clamp(34px, 5.4vw, 58px)",
              lineHeight: 1.02,
              letterSpacing: "-0.015em",
              margin: "0 0 20px",
            }}
          >
            Your spreadsheet, rebuilt as an app your team actually uses.
          </h1>
          <p
            style={{
              fontSize: 18,
              lineHeight: 1.55,
              color: c.body,
              maxWidth: "34em",
              margin: "0 0 28px",
              textWrap: "pretty",
            }}
          >
            Send us the spreadsheet you run on. A person turns it into a phone
            app — your data already inside — in 48 hours. Flat ${MONTHLY} a
            month, no per-seat pricing. First few builds free. You never touch a
            builder.
          </p>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              alignItems: "flex-start",
            }}
          >
            <Link
              href="/start"
              className="cl-btn-orange"
              style={{
                background: c.orange,
                color: c.paper,
                textDecoration: "none",
                fontFamily: f.display,
                fontWeight: 700,
                fontSize: 18,
                padding: "17px 28px",
                borderRadius: 4,
              }}
            >
              Send my spreadsheet
            </Link>
            <div style={{ fontSize: 14, color: c.muted, fontStyle: "italic" }}>
              Free preview from your real data. No card, no account. Send it
              today — see it by {ready}.
            </div>
            <a href="#demo" style={{ fontSize: 15, marginTop: 6 }}>
              Try a live one — 30 seconds
            </a>
          </div>
        </div>

        <HeroAnimation />
      </section>

      {/* ── three-up promise ──────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "4px 20px 20px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            border: `2px solid ${c.ink}`,
            borderRadius: 4,
            overflow: "hidden",
            background: c.paper,
          }}
        >
          {[
            ["01", "A human builds it"],
            ["02", `Flat $${MONTHLY}/mo, no seats`],
            ["03", "First few free"],
          ].map(([n, label], i) => (
            <div
              key={n}
              style={{
                padding: "16px 18px",
                borderRight: i < 2 ? `1px solid ${c.lineSoft}` : undefined,
              }}
            >
              <div
                style={{
                  fontFamily: f.mono,
                  fontSize: 11,
                  letterSpacing: "0.1em",
                  color: c.orange,
                  marginBottom: 6,
                }}
              >
                {n}
              </div>
              <div
                style={{
                  fontFamily: f.display,
                  fontWeight: 900,
                  fontSize: 16,
                  lineHeight: 1.12,
                }}
              >
                {label}
              </div>
            </div>
          ))}
        </div>
        <div
          style={{
            fontFamily: f.mono,
            fontSize: 12.5,
            color: c.muted,
            letterSpacing: "0.04em",
            marginTop: 16,
          }}
        >
          Free preview · Live in 48 hours · CSV export anytime · Cancel anytime
        </div>
      </div>

      {/* ── the problem ───────────────────────────────────────────────────── */}
      <section
        style={{
          background: c.paper,
          borderTop: `1px solid ${c.lineSoft}`,
          borderBottom: `1px solid ${c.lineSoft}`,
        }}
      >
        <div style={{ maxWidth: 860, margin: "0 auto", padding: "72px 20px" }}>
          <h2
            style={{
              fontFamily: f.display,
              fontWeight: 900,
              fontSize: "clamp(26px, 3.6vw, 40px)",
              lineHeight: 1.08,
              margin: "0 0 40px",
              maxWidth: "18em",
            }}
          >
            The spreadsheet works fine. Until it leaves the office.
          </h2>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 26,
              marginBottom: 44,
            }}
          >
            {[
              "Nobody updates it from their phone. So it's always days behind.",
              "Two people edit it. One version wins. The other person's entries vanish.",
              "It lives on one laptop. The people who need it never have it open.",
            ].map((line, i) => (
              <div
                key={line}
                style={{
                  display: "flex",
                  gap: 16,
                  alignItems: "baseline",
                  borderBottom: `1px solid ${c.lineFaint}`,
                  paddingBottom: 22,
                }}
              >
                <div
                  style={{
                    fontFamily: f.mono,
                    fontSize: 13,
                    color: c.orange,
                    flexShrink: 0,
                  }}
                >
                  0{i + 1}
                </div>
                <div
                  style={{
                    fontSize: 18,
                    fontStyle: "italic",
                    color: c.body,
                    lineHeight: 1.5,
                  }}
                >
                  {line}
                </div>
              </div>
            ))}
          </div>
          <p
            style={{
              fontFamily: f.display,
              fontWeight: 900,
              fontSize: "clamp(20px, 2.6vw, 27px)",
              lineHeight: 1.25,
              margin: "0 0 32px",
              maxWidth: "24em",
            }}
          >
            Add up the hours your team loses to the sheet being wrong, missing,
            or behind. That&apos;s what this costs to ignore.
          </p>
          <LossCalculator />
        </div>
      </section>

      {/* ── live demo ─────────────────────────────────────────────────────── */}
      <section
        id="demo"
        style={{
          maxWidth: 860,
          margin: "0 auto",
          padding: "72px 20px",
          display: "flex",
          flexWrap: "wrap",
          gap: 44,
          alignItems: "center",
        }}
      >
        <div style={{ flex: "1 1 320px", minWidth: 280 }}>
          <div
            style={{
              fontFamily: f.mono,
              fontSize: 13,
              letterSpacing: "0.12em",
              color: c.muted,
              marginBottom: 14,
            }}
          >
            TRY ONE
          </div>
          <h2
            style={{
              fontFamily: f.display,
              fontWeight: 900,
              fontSize: "clamp(26px, 3.6vw, 38px)",
              lineHeight: 1.08,
              margin: "0 0 16px",
            }}
          >
            Here&apos;s one we built. Yours is built from your sheet.
          </h2>
          <p
            style={{
              fontSize: 17,
              lineHeight: 1.55,
              color: c.body,
              margin: 0,
            }}
          >
            The whole thing is live. Add an item, mark one{" "}
            <strong>Returned</strong>, search the log, open the dash. Everything
            is this simple, because a team on their phones won&apos;t use
            anything that isn&apos;t.
          </p>
          <p
            style={{
              fontFamily: f.mono,
              fontSize: 13,
              color: c.muted,
              margin: "22px 0 0",
            }}
          >
            We build these in about 30 minutes. Yours is next.
          </p>
          <Link
            href="/start"
            className="cl-btn-dark"
            style={{
              display: "inline-block",
              marginTop: 18,
              background: c.ink,
              color: c.paper,
              textDecoration: "none",
              fontFamily: f.display,
              fontWeight: 700,
              fontSize: 15,
              padding: "14px 22px",
              borderRadius: 4,
            }}
          >
            Start mine — free preview
          </Link>

          <div style={{ marginTop: 26 }}>
            <div
              style={{
                fontFamily: f.mono,
                fontSize: 11,
                letterSpacing: "0.1em",
                color: c.faint,
                marginBottom: 10,
              }}
            >
              SAME BUILD, ANY SHEET
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {["inventory", "client list", "equipment", "memberships", "job log"].map(
                (tag) => (
                  <span
                    key={tag}
                    style={{
                      fontFamily: f.mono,
                      fontSize: 11.5,
                      color: c.muted,
                      border: `1px solid ${c.lineSoft}`,
                      borderRadius: 999,
                      padding: "4px 11px",
                    }}
                  >
                    {tag}
                  </span>
                ),
              )}
            </div>
          </div>
        </div>

        <div style={{ flex: "0 1 322px", margin: "0 auto" }}>
          <PhoneFrame width={322}>
            <iframe
              src="/demo?brand=Sample%20Co."
              title="A working CrewLog app, loaded with sample data"
              style={{ display: "block", width: "100%", height: 584, border: "none" }}
            />
          </PhoneFrame>
        </div>
      </section>

      {/* ── how it works ──────────────────────────────────────────────────── */}
      <section style={{ background: c.band, borderTop: `1px solid ${c.lineSoft}` }}>
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "72px 20px" }}>
          <div
            style={{
              fontFamily: f.mono,
              fontSize: 13,
              letterSpacing: "0.12em",
              color: c.muted,
              marginBottom: 24,
            }}
          >
            HOW IT WORKS
          </div>
          <WorkOrderSteps />
        </div>
      </section>

      {/* ── pricing ───────────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 860, margin: "0 auto", padding: "72px 20px" }}>
        <div
          style={{
            fontFamily: f.mono,
            fontSize: 13,
            letterSpacing: "0.12em",
            color: c.muted,
            marginBottom: 24,
          }}
        >
          PRICING
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 32,
            alignItems: "flex-start",
          }}
        >
          <div
            style={{
              flex: "0 1 340px",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div
              style={{
                background: c.orange,
                color: c.paper,
                borderRadius: 4,
                padding: "15px 18px",
                boxShadow: shadow.buttonSm,
              }}
            >
              <div
                style={{
                  fontFamily: f.display,
                  fontWeight: 900,
                  fontSize: 16,
                  letterSpacing: "0.03em",
                }}
              >
                FIRST FEW FREE
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.45, marginTop: 5 }}>
                Building my first handful of apps free to get them right. If this
                flag is still up, that offer is open — you&apos;re in.
              </div>
            </div>

            <div
              style={{
                background: c.paper,
                border: `2px solid ${c.ink}`,
                borderRadius: 4,
                padding: "30px 28px",
                position: "relative",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: -12,
                  left: 24,
                  background: c.ink,
                  color: c.paper,
                  fontFamily: f.mono,
                  fontSize: 11,
                  letterSpacing: "0.1em",
                  padding: "4px 10px",
                }}
              >
                ONE PLAN
              </div>
              <div
                style={{
                  fontFamily: f.display,
                  fontWeight: 900,
                  fontSize: 62,
                  lineHeight: 1,
                  letterSpacing: "-0.02em",
                }}
              >
                ${MONTHLY}
                <span style={{ fontSize: 24, fontWeight: 700, color: c.muted }}>
                  /mo
                </span>
              </div>
              <div
                style={{
                  fontSize: 13.5,
                  color: c.muted,
                  fontStyle: "italic",
                  marginTop: 4,
                }}
              >
                flat — no per-seat pricing, ever.
              </div>
              <div style={{ fontSize: 16, color: c.body, marginTop: 8 }}>
                + ${SETUP} one-time setup
              </div>
              <div
                style={{
                  fontFamily: f.mono,
                  fontSize: 12.5,
                  color: c.muted,
                  marginTop: 6,
                }}
              >
                25 GB storage · unlimited team · no per-seat pricing
              </div>
              <div
                style={{
                  borderTop: `1px solid ${c.lineFaint}`,
                  margin: "22px 0 0",
                  paddingTop: 18,
                  display: "flex",
                  flexDirection: "column",
                  gap: 13,
                  fontSize: 15,
                  lineHeight: 1.45,
                }}
              >
                {[
                  <>Unlimited team members</>,
                  <>Unlimited entries — 25 GB covers years of entries and photos.</>,
                  <>
                    <strong>Changes handled for you.</strong> Need a new column?
                    Reply to any email from us. Done within a day.
                  </>,
                  <>CSV export &amp; sheet sync. Your data was never ours.</>,
                  <>Works on any phone, nothing to install</>,
                ].map((line, i) => (
                  <div key={i} style={{ display: "flex", gap: 10 }}>
                    <span style={{ color: c.orange, fontWeight: 700 }}>✓</span>
                    <span>{line}</span>
                  </div>
                ))}
              </div>
            </div>

            <div
              style={{
                fontFamily: f.mono,
                fontSize: 12,
                color: c.muted,
                letterSpacing: "0.02em",
                padding: "0 4px",
              }}
            >
              Need more room? +${MONTHLY}/mo per extra 25 GB. That&apos;s the
              whole price list.
            </div>
          </div>

          <div style={{ flex: "1 1 340px", minWidth: 280 }}>
            <div style={{ overflowX: "auto" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(58px, 0.8fr) 1fr 1fr 1.1fr",
                  minWidth: 440,
                  fontSize: 13.5,
                  border: `1px solid ${c.line}`,
                  borderRadius: 4,
                  overflow: "hidden",
                  background: c.paper,
                }}
              >
                <div style={{ padding: 10 }} />
                <div
                  style={{
                    padding: 10,
                    fontFamily: f.mono,
                    fontSize: 11,
                    color: c.muted,
                  }}
                >
                  Custom developer
                </div>
                <div
                  style={{
                    padding: 10,
                    fontFamily: f.mono,
                    fontSize: 11,
                    color: c.muted,
                  }}
                >
                  DIY app builders
                </div>
                <div
                  style={{
                    padding: 10,
                    fontFamily: f.display,
                    fontWeight: 900,
                    fontSize: 13,
                    background: c.ink,
                    color: c.paper,
                  }}
                >
                  CREWLOG
                </div>

                {[
                  ["Cost", "$3,000+", "$60+/mo", `$${SETUP} once + $${MONTHLY}/mo`, true],
                  ["Your time", "weeks of meetings", "your weekends", "one email", false],
                  ["Live in", "6 weeks", "whenever you finish", "48 hours", false],
                ].map(([label, a, b, mine, accent]) => (
                  <div key={String(label)} style={{ display: "contents" }}>
                    <div
                      style={{
                        padding: 10,
                        fontFamily: f.mono,
                        fontSize: 11,
                        color: c.muted,
                        borderTop: `1px solid ${c.lineFaint}`,
                      }}
                    >
                      {label}
                    </div>
                    <div style={{ padding: 10, borderTop: `1px solid ${c.lineFaint}` }}>
                      {a}
                    </div>
                    <div style={{ padding: 10, borderTop: `1px solid ${c.lineFaint}` }}>
                      {b}
                    </div>
                    <div
                      style={{
                        padding: 10,
                        borderTop: `1px solid ${c.lineFaint}`,
                        fontWeight: 700,
                        color: accent ? c.orange : undefined,
                      }}
                    >
                      {mine}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <p
              style={{
                fontSize: 14.5,
                color: c.muted,
                lineHeight: 1.55,
                margin: "18px 0 0",
                fontStyle: "italic",
                textWrap: "pretty",
              }}
            >
              The ${SETUP} covers a human building your app by hand. It&apos;s
              why there&apos;s no 14-day trial that forgets to cancel itself.
            </p>
          </div>
        </div>
      </section>

      {/* ── the deal ──────────────────────────────────────────────────────── */}
      <section style={{ background: c.ink, color: c.paper }}>
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "68px 20px" }}>
          <div
            style={{
              display: "inline-block",
              fontFamily: f.display,
              fontWeight: 900,
              fontSize: 26,
              letterSpacing: "0.06em",
              color: c.orange,
              border: `3px solid ${c.orange}`,
              padding: "6px 16px",
              transform: "rotate(-2deg)",
              marginBottom: 32,
            }}
          >
            THE DEAL
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 18,
              fontSize: 17.5,
              lineHeight: 1.5,
            }}
          >
            {[
              <>
                If the preview isn&apos;t right, you owe nothing and keep the CSV
                cleanup we did.
              </>,
              <>If we miss 48 hours from confirming your spot, setup is free.</>,
              <>
                Cancel anytime. You get a full CSV of everything within a day.
              </>,
              <>
                Every app is built by the same person who answers{" "}
                <a href="mailto:build@crewlog.app" style={{ color: c.paper }}>
                  build@crewlog.app
                </a>
                .
              </>,
            ].map((line, i) => (
              <div key={i} style={{ display: "flex", gap: 14 }}>
                <span style={{ color: c.orange, fontFamily: f.mono }}>→</span>
                <span>{line}</span>
              </div>
            ))}
          </div>
          <Link
            href="/start"
            className="cl-btn-orange"
            style={{
              display: "inline-block",
              marginTop: 34,
              background: c.orange,
              color: c.paper,
              textDecoration: "none",
              fontFamily: f.display,
              fontWeight: 700,
              fontSize: 17,
              padding: "16px 26px",
              borderRadius: 4,
            }}
          >
            Send my spreadsheet
          </Link>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 760, margin: "0 auto", padding: "72px 20px" }}>
        <div
          style={{
            fontFamily: f.mono,
            fontSize: 13,
            letterSpacing: "0.12em",
            color: c.muted,
            marginBottom: 24,
          }}
        >
          QUESTIONS
        </div>
        <Faq />
      </section>

      {/* ── closing CTA ───────────────────────────────────────────────────── */}
      <section style={{ background: c.orange }}>
        <div
          style={{
            maxWidth: 860,
            margin: "0 auto",
            padding: "76px 20px",
            textAlign: "center",
          }}
        >
          <h2
            style={{
              fontFamily: f.display,
              fontWeight: 900,
              fontSize: "clamp(30px, 4.6vw, 50px)",
              lineHeight: 1.05,
              color: c.ink,
              margin: "0 0 26px",
            }}
          >
            Send the spreadsheet.
            <br />
            See it as an app by {ready}.
          </h2>
          <Link
            href="/start"
            className="cl-btn-dark"
            style={{
              display: "inline-block",
              background: c.ink,
              color: c.paper,
              textDecoration: "none",
              fontFamily: f.display,
              fontWeight: 700,
              fontSize: 19,
              padding: "18px 32px",
              borderRadius: 4,
            }}
          >
            Send my spreadsheet
          </Link>
          <div
            style={{
              fontSize: 14.5,
              color: c.ink,
              marginTop: 14,
              fontStyle: "italic",
            }}
          >
            Free preview. No card. Worst case, you wasted one email.
          </div>
          <div
            style={{
              fontFamily: f.mono,
              fontSize: 12.5,
              letterSpacing: "0.08em",
              color: c.ink,
              marginTop: 20,
            }}
          >
            BUILT BY HAND, IN ORDER RECEIVED · WE TAKE ON 5 BUILDS A WEEK
          </div>
        </div>
      </section>

      <SiteFooter />
      <StickyCta />
    </>
  );
}
