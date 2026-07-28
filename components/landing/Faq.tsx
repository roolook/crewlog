"use client";

import { useState } from "react";
import { c, f } from "@/lib/theme";

const ITEMS: [string, string][] = [
  [
    "My spreadsheet is a mess. It's actually three spreadsheets.",
    "That's normal. Send all of it. Untangling it is part of setup.",
  ],
  [
    "Does my team need to download anything?",
    "No. It runs in the phone's browser and pins to the home screen like an app.",
  ],
  ["Passwords?", "None. Everyone gets a login link by email. Tap it, you're in."],
  [
    "What if I cancel?",
    "You get a CSV of every entry. Nothing is held hostage.",
  ],
  [
    "Is my data mixed with other companies?",
    "No. Every company's data is fully isolated.",
  ],
  [
    "Will it work for what I track?",
    "If it lives in a spreadsheet — inventory, clients, equipment, members, jobs — we can turn it into an app. Email us the sheet and ask.",
  ],
  [
    "Why is it this cheap?",
    "No salespeople, no ads, no self-serve builder to maintain. Software does the heavy lifting; a person does the finish work.",
  ],
  [
    "What happens if I fill 25 GB?",
    "That's years away for most teams — photos are the only thing that adds up. If you get there, it's +$10 a month per extra 25 GB, and we'll tell you before it matters.",
  ],
];

export function Faq() {
  const [open, setOpen] = useState(-1);

  return (
    <div style={{ borderTop: `1px solid ${c.line}` }}>
      {ITEMS.map(([q, a], i) => (
        <div key={q} style={{ borderBottom: `1px solid ${c.line}` }}>
          <button
            onClick={() => setOpen(open === i ? -1 : i)}
            aria-expanded={open === i}
            className="cl-faq"
            style={{
              width: "100%",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 16,
              background: "none",
              border: "none",
              textAlign: "left",
              padding: "18px 4px",
              cursor: "pointer",
              fontFamily: f.sans,
              fontSize: 16,
              fontWeight: 600,
              color: c.ink,
            }}
          >
            <span>{q}</span>
            <span
              style={{
                fontFamily: f.mono,
                color: c.orange,
                fontSize: 18,
                flexShrink: 0,
              }}
              aria-hidden
            >
              {open === i ? "–" : "+"}
            </span>
          </button>
          {open === i && (
            <div
              style={{
                fontSize: 16,
                lineHeight: 1.55,
                color: c.body,
                padding: "0 4px 20px",
                maxWidth: "38em",
              }}
            >
              {a}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
