import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { HeroAnimation } from "@/components/landing/HeroAnimation";
import { LossCalculator } from "@/components/landing/LossCalculator";
import { Faq } from "@/components/landing/Faq";
import { StickyCta } from "@/components/landing/StickyCta";
import { WorkOrderSteps } from "@/components/landing/WorkOrderSteps";
import { AskForAnything } from "@/components/landing/AskForAnything";
import { PhoneFrame } from "@/components/PhoneFrame";
import { Check, Arrow } from "@/components/Icon";
import { c, f, shadow, band } from "@/lib/theme";
import { readyDay } from "@/lib/format";

const SETUP = process.env.NEXT_PUBLIC_SETUP_FEE ?? "99";
const CUSTOM_SETUP = process.env.NEXT_PUBLIC_CUSTOM_SETUP_FEE ?? "299";
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
            FOR ANYONE WHOSE BUSINESS RUNS ON A SPREADSHEET
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
            Your spreadsheet, rebuilt as the app you actually needed.
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
            Send us the sheet and tell us what it should do. A person builds it
            into a phone app — your data already inside — in 48 hours. Tick the
            map pin, the photos, the signature; ask for anything else and
            we&apos;ll tell you straight. You never touch a builder.
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
              Free preview built from your real data. No card, no account. Send
              it today, see it by {ready}.
            </div>
            <a href="#demo" style={{ fontSize: 16, marginTop: 6 }}>
              Try a live one (30 seconds)
            </a>
          </div>
        </div>

        <HeroAnimation />
      </section>

      {/* ── terms strip ───────────────────────────────────────────────────────
          This used to be a 3-up card grid restating the hero (a human builds it
          / flat monthly / first few free) — all three of which the pricing and
          deal sections already say properly. One ruled line does the job. */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "8px 20px 4px" }}>
        <div
          style={{
            fontFamily: f.mono,
            fontSize: 12,
            color: c.muted,
            letterSpacing: "0.04em",
            borderTop: `1px solid ${c.lineSoft}`,
            paddingTop: 14,
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
        <div style={{ maxWidth: 860, margin: "0 auto", padding: band.wide }}>
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
          padding: band.tight,
          display: "flex",
          flexWrap: "wrap",
          gap: 44,
          alignItems: "center",
        }}
      >
        <div style={{ flex: "1 1 320px", minWidth: 280 }}>
          {/* No mono eyebrow here — the heading already says "here's one we
              built", and a kicker above every single section is the rhythm that
              makes a page read as a template. */}
          <h2
            style={{
              fontFamily: f.display,
              fontWeight: 900,
              fontSize: "clamp(26px, 3.6vw, 38px)",
              lineHeight: 1.08,
              margin: "0 0 16px",
            }}
          >
            Here&apos;s one we built. Yours is built to do your job.
          </h2>
          <p
            style={{
              fontSize: 18,
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
              fontSize: 16,
              padding: "14px 22px",
              borderRadius: 4,
            }}
          >
            Build mine from my sheet
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
              BUILT FROM SHEETS LIKE THESE
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {[
                "inventory",
                "quotes",
                "inspections",
                "punch lists",
                "deliveries",
                "route sheets",
                "client list",
                "equipment",
                "timesheets",
                "job log",
              ].map(
                (tag) => (
                  <span
                    key={tag}
                    style={{
                      fontFamily: f.mono,
                      fontSize: 12,
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

      {/* ── ask for anything ──────────────────────────────────────────────── */}
      <section
        style={{
          background: c.paper,
          borderTop: `1px solid ${c.lineSoft}`,
          borderBottom: `1px solid ${c.lineSoft}`,
        }}
      >
        <div style={{ maxWidth: 860, margin: "0 auto", padding: band.normal }}>
          <AskForAnything />
        </div>
      </section>

      {/* ── how it works ──────────────────────────────────────────────────── */}
      <section style={{ background: c.band, borderTop: `1px solid ${c.lineSoft}` }}>
        <div style={{ maxWidth: 760, margin: "0 auto", padding: band.normal }}>
          <h2
            style={{
              fontFamily: f.mono,
              fontWeight: 400,
              fontSize: 13,
              letterSpacing: "0.12em",
              color: c.muted,
              margin: "0 0 24px",
            }}
          >
            HOW IT WORKS
          </h2>
          <WorkOrderSteps />
        </div>
      </section>

      {/* ── pricing ───────────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 860, margin: "0 auto", padding: band.wide }}>
        <h2
          style={{
            fontFamily: f.mono,
            fontWeight: 400,
            fontSize: 13,
            letterSpacing: "0.12em",
            color: c.muted,
            margin: "0 0 24px",
          }}
        >
          PRICING
        </h2>
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
                I&apos;m building my first handful of apps free, to get the
                process right. If you&apos;re reading this, the offer is open.
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
                STANDARD
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
                  fontSize: 14,
                  color: c.muted,
                  fontStyle: "italic",
                  marginTop: 4,
                }}
              >
                flat. No per-seat pricing, ever.
              </div>
              <div style={{ fontSize: 16, color: c.body, marginTop: 8 }}>
                + ${SETUP} one-time setup
              </div>
              <div
                style={{
                  fontFamily: f.mono,
                  fontSize: 12,
                  color: c.muted,
                  marginTop: 6,
                }}
              >
                25 GB storage · unlimited team
              </div>
              <div
                style={{
                  borderTop: `1px solid ${c.lineFaint}`,
                  margin: "22px 0 0",
                  paddingTop: 18,
                  display: "flex",
                  flexDirection: "column",
                  gap: 13,
                  fontSize: 16,
                  lineHeight: 1.45,
                }}
              >
                {[
                  <>Unlimited team members</>,
                  <>Unlimited entries. 25 GB covers years of entries and photos.</>,
                  <>
                    <strong>Changes handled for you.</strong> Need a new column?
                    Reply to any email from us. Done within a day.
                  </>,
                  <>CSV export &amp; sheet sync. Your data was never ours.</>,
                  <>Works on any phone, nothing to install</>,
                ].map((line, i) => (
                  <div key={i} style={{ display: "flex", gap: 10 }}>
                    <Check color={c.orange} style={{ marginTop: 5 }} />
                    <span>{line}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* The second tier exists because a map picker fits inside a
                standard build and a bespoke app doesn't. Saying so up front
                beats quoting every job. */}
            <div
              style={{
                background: c.paper,
                border: `1px solid ${c.line}`,
                borderRadius: 4,
                padding: "22px 28px 24px",
                position: "relative",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: -12,
                  left: 24,
                  background: c.paper,
                  border: `1px solid ${c.line}`,
                  color: c.muted,
                  fontFamily: f.mono,
                  fontSize: 11,
                  letterSpacing: "0.1em",
                  padding: "4px 10px",
                }}
              >
                CUSTOM
              </div>
              <div
                style={{
                  fontFamily: f.display,
                  fontWeight: 900,
                  fontSize: 40,
                  lineHeight: 1,
                  letterSpacing: "-0.02em",
                }}
              >
                ${CUSTOM_SETUP}
                <span style={{ fontSize: 18, fontWeight: 700, color: c.muted }}>
                  {" "}
                  once
                </span>
              </div>
              <div
                style={{
                  fontSize: 14,
                  color: c.muted,
                  fontStyle: "italic",
                  marginTop: 4,
                }}
              >
                + the same ${MONTHLY} a month.
              </div>
              <p
                style={{
                  fontSize: 16,
                  color: c.body,
                  lineHeight: 1.5,
                  margin: "14px 0 0",
                }}
              >
                For when the standard build genuinely isn&apos;t the shape of your
                job — a screen laid out around your day, a flow nobody else has.
                We&apos;ll say which one you need before you pay either.
              </p>
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
                  fontSize: 14,
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
                fontSize: 14,
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
        <div style={{ maxWidth: 760, margin: "0 auto", padding: band.normal }}>
          <div
            style={{
              display: "inline-block",
              fontFamily: f.display,
              fontWeight: 900,
              fontSize: 24,
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
              fontSize: 18,
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
                <Arrow color={c.orange} size={16} style={{ marginTop: 5 }} />
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
              fontSize: 18,
              padding: "16px 26px",
              borderRadius: 4,
            }}
          >
            Start my build
          </Link>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 760, margin: "0 auto", padding: band.tight }}>
        {/* A real heading rather than another mono kicker: this section had no
            h2 at all, and it breaks the every-section-opens-the-same rhythm. */}
        <h2
          style={{
            fontFamily: f.display,
            fontWeight: 900,
            fontSize: "clamp(24px, 3.2vw, 34px)",
            lineHeight: 1.08,
            margin: "0 0 24px",
          }}
        >
          Questions people actually ask.
        </h2>
        <Faq />
      </section>

      {/* ── closing CTA ───────────────────────────────────────────────────── */}
      <section style={{ background: c.orange }}>
        <div
          style={{
            maxWidth: 860,
            margin: "0 auto",
            padding: band.wide,
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
              fontSize: 18,
              padding: "18px 32px",
              borderRadius: 4,
            }}
          >
            Send my spreadsheet
          </Link>
          <div
            style={{
              fontSize: 14,
              color: c.ink,
              marginTop: 14,
              fontStyle: "italic",
            }}
          >
            Free preview. No card, no account.
          </div>
          <div
            style={{
              fontFamily: f.mono,
              fontSize: 12,
              letterSpacing: "0.08em",
              color: c.ink,
              marginTop: 20,
            }}
          >
            BUILT BY HAND, IN THE ORDER RECEIVED
          </div>
        </div>
      </section>

      <SiteFooter />
      <StickyCta />
    </>
  );
}
