"use client";

import { useEffect, useRef, useState } from "react";
import { c, f, shadow } from "@/lib/theme";
import { HomeIndicator, StatusBar } from "@/components/PhoneFrame";

const SHEET: { cells: string[]; title: string; meta: string }[] = [
  {
    cells: ["MacBook Pro 14″", "Alex", "Downtown office", "In use", "7/12"],
    title: "MacBook Pro 14″",
    meta: "Alex · Downtown office",
  },
  {
    cells: ["Van keys — Unit 3", "front desk", "Main shop", "Available", "6/30"],
    title: "Van keys — Unit 3",
    meta: "Main shop · available",
  },
  {
    cells: ["Booth kit A", "Ray", "Warehouse", "Checked out", "7/14"],
    title: "Booth kit A",
    meta: "Ray · warehouse",
  },
  {
    cells: ["Membership — J. Ortiz", "—", "—", "Active", "7/09"],
    title: "Membership — J. Ortiz",
    meta: "Active · renewed",
  },
];

const COLS = "1.7fr 1fr 1fr 1fr 0.8fr";

/**
 * Rows fade out of the spreadsheet and reappear as cards in the phone, one at a
 * time. This is the whole pitch in six seconds, so it waits until it scrolls
 * into view before playing and offers a replay once it's done.
 */
export function HeroAnimation() {
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setStep(SHEET.length);
      setDone(true);
      return;
    }

    const tick = () =>
      setStep((s) => {
        const next = s + 1;
        if (next >= SHEET.length) setDone(true);
        else timer.current = setTimeout(tick, 750);
        return next;
      });

    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            io.disconnect();
            timer.current = setTimeout(tick, 450);
          }
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const replay = () => {
    if (timer.current) clearTimeout(timer.current);
    setStep(0);
    setDone(false);
    const tick = () =>
      setStep((s) => {
        const next = s + 1;
        if (next >= SHEET.length) setDone(true);
        else timer.current = setTimeout(tick, 750);
        return next;
      });
    timer.current = setTimeout(tick, 500);
  };

  return (
    <div ref={ref} style={{ flex: "1 1 420px", minWidth: 300 }}>
      {/* ── the spreadsheet ── */}
      <div
        style={{
          background: c.paper,
          border: `1px solid ${c.line}`,
          borderRadius: 3,
          boxShadow: shadow.hairline,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 12px",
            borderBottom: `1px solid ${c.lineSoft}`,
            background: c.paperAlt,
          }}
        >
          <div style={{ fontFamily: f.mono, fontSize: 12, color: c.muted }}>
            tracker-2026.xlsx
          </div>
          <button
            onClick={replay}
            style={{
              fontFamily: f.mono,
              fontSize: 12,
              color: c.ink,
              background: "none",
              border: `1px solid ${c.line}`,
              borderRadius: 3,
              padding: "3px 9px",
              cursor: "pointer",
              visibility: done ? "visible" : "hidden",
            }}
          >
            ↻ replay
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: COLS,
            fontFamily: f.mono,
            fontSize: 11,
            color: c.muted,
            borderBottom: `1px solid ${c.lineSoft}`,
          }}
        >
          {["Item", "Owner", "Location", "Status", "Updated"].map((h, i) => (
            <div
              key={h}
              style={{
                padding: "6px 8px",
                borderRight: i < 4 ? `1px solid ${c.lineFaint}` : undefined,
              }}
            >
              {h}
            </div>
          ))}
        </div>

        {SHEET.map((row, i) => (
          <div
            key={row.title}
            style={{
              display: "grid",
              gridTemplateColumns: COLS,
              fontFamily: f.mono,
              fontSize: 12,
              color: c.body,
              opacity: step > i ? 0.25 : 1,
              transition: "opacity 0.5s ease",
            }}
          >
            {row.cells.map((cell, j) => (
              <div
                key={j}
                style={{
                  padding: "7px 8px",
                  borderRight: `1px solid ${c.lineFaint}`,
                  borderBottom: `1px solid #EDEBE4`,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {cell}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          padding: "10px 0",
          fontFamily: f.mono,
          color: c.orange,
          fontSize: 18,
        }}
      >
        ↓
      </div>

      {/* ── the phone ── */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <div
          style={{
            width: 310,
            maxWidth: "100%",
            background: c.ink,
            borderRadius: 50,
            padding: 10,
            boxShadow: shadow.phone,
          }}
        >
          <div
            style={{
              background: c.paper,
              borderRadius: 40,
              overflow: "hidden",
              position: "relative",
            }}
          >
            <StatusBar />
            <div
              style={{
                padding: "13px 14px 9px",
                borderBottom: `2px solid ${c.ink}`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <div
                  style={{ width: 9, height: 9, background: c.orange }}
                />
                <div
                  style={{
                    fontFamily: f.display,
                    fontWeight: 900,
                    fontSize: 16,
                  }}
                >
                  Sample Co.
                </div>
              </div>
              <div
                style={{
                  fontFamily: f.mono,
                  fontSize: 10,
                  letterSpacing: "0.1em",
                  color: c.muted,
                  marginTop: 4,
                }}
              >
                SHARED LOG · TODAY
              </div>
            </div>

            <div
              style={{
                padding: "10px 10px 14px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
                minHeight: 430,
                position: "relative",
                background: c.bg,
              }}
            >
              {SHEET.map((row, i) => (
                <div
                  key={row.title}
                  style={{
                    background: c.paper,
                    border: `1px solid ${c.line}`,
                    boxShadow: "2px 2px 0 rgba(23,24,27,0.08)",
                    borderRadius: 2,
                    padding: "9px 11px",
                    opacity: step > i ? 1 : 0,
                    transform: step > i ? "translateY(0)" : "translateY(14px)",
                    transition:
                      "opacity 0.35s ease-out, transform 0.35s ease-out",
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 14 }}>
                    {row.title}
                  </div>
                  <div
                    style={{
                      fontFamily: f.mono,
                      fontSize: 11,
                      color: c.muted,
                      marginTop: 3,
                    }}
                  >
                    {row.meta}
                  </div>
                </div>
              ))}
              <div
                style={{
                  position: "absolute",
                  right: 12,
                  bottom: 12,
                  background: c.orange,
                  color: c.paper,
                  fontFamily: f.display,
                  fontWeight: 700,
                  fontSize: 13,
                  padding: "10px 14px",
                  borderRadius: 2,
                  boxShadow: shadow.buttonSm,
                }}
              >
                + LOG
              </div>
            </div>

            <div style={{ display: "flex", background: c.ink }}>
              {["LOG", "SEARCH", "DASH", "TEAM", "SET"].map((t, i) => (
                <div
                  key={t}
                  style={{
                    flex: 1,
                    textAlign: "center",
                    fontFamily: f.mono,
                    fontSize: 10,
                    letterSpacing: "0.08em",
                    color: i === 0 ? c.paper : c.faint,
                    fontWeight: i === 0 ? 700 : 400,
                    padding: "10px 2px 11px",
                    borderTop: `3px solid ${i === 0 ? c.orange : "transparent"}`,
                  }}
                >
                  {t}
                </div>
              ))}
            </div>
            <HomeIndicator />
          </div>
        </div>
      </div>
    </div>
  );
}
