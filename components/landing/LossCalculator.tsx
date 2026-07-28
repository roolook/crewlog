"use client";

import Link from "next/link";
import { useState } from "react";
import { Arrow } from "@/components/Icon";
import { c, f } from "@/lib/theme";

/** Hours-a-week × hourly rate × 52, next to what CrewLog costs for a year. */
export function LossCalculator() {
  const [hours, setHours] = useState(4);
  const [rate, setRate] = useState("30");

  const rateNum = Number(rate.replace(/[^0-9.]/g, "")) || 0;
  const annual = Math.round(hours * rateNum * 52);
  const setup = Number(process.env.NEXT_PUBLIC_SETUP_FEE ?? 99);
  const monthly = Number(process.env.NEXT_PUBLIC_MONTHLY_FEE ?? 10);
  const firstYear = setup + monthly * 12;

  const note =
    rateNum > 0
      ? `That's about $${annual.toLocaleString("en-US")} a year in time spent fighting the sheet. CrewLog is $${firstYear} your first year ($${setup} setup + 12 × $${monthly}).`
      : `Even a few hours a week adds up fast. CrewLog is $${firstYear} your first year — $${setup} setup + 12 × $${monthly}.`;

  return (
    <div
      style={{
        border: `1px dashed ${c.line}`,
        borderRadius: 4,
        padding: "18px 20px",
        display: "flex",
        flexWrap: "wrap",
        gap: 18,
        alignItems: "center",
        background: c.bg,
      }}
    >
      <label
        style={{
          fontFamily: f.mono,
          fontSize: 13,
          color: c.muted,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        Hours/week lost to the sheet
        <input
          type="range"
          min={1}
          max={20}
          value={hours}
          onChange={(e) => setHours(Number(e.target.value))}
          style={{ width: 130 }}
          aria-label="Hours per week lost to the spreadsheet"
        />
        <span style={{ color: c.ink, fontWeight: 600 }}>{hours}</span>
      </label>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontFamily: f.mono,
          color: c.muted,
          fontSize: 13,
        }}
      >
        at <span>$</span>
        <input
          type="text"
          inputMode="numeric"
          placeholder="30"
          value={rate}
          onChange={(e) => setRate(e.target.value.replace(/[^0-9.]/g, ""))}
          aria-label="Hourly rate in dollars"
          style={{
            width: 62,
            fontFamily: f.mono,
            fontSize: 18,
            padding: "8px 10px",
            border: `1px solid ${c.line}`,
            borderRadius: 3,
            background: c.paper,
          }}
        />
        /hr, roughly
      </div>

      <div
        style={{
          fontSize: 14,
          color: c.muted,
          fontStyle: "italic",
          flexBasis: "100%",
        }}
      >
        {note}{" "}
        <Link
          href="/start"
          style={{
            fontStyle: "normal",
            fontWeight: 600,
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
          }}
        >
          Send the sheet
          <Arrow size={13} />
        </Link>
      </div>
    </div>
  );
}
