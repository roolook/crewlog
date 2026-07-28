"use client";

import { useState } from "react";
import { c, f } from "@/lib/theme";

const ITEMS: [string, string][] = [
  [
    "My spreadsheet is a mess. It's actually three spreadsheets.",
    "That's normal. Send all of it. Untangling it is part of setup.",
  ],
  [
    "Is this an app builder I have to learn?",
    "No - the opposite. You never see a builder, a template or a settings screen. You send a spreadsheet, a person builds the app, you get a link.",
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
    "Will it work for what I do?",
    "If it lives in a spreadsheet, it can be an app - inventory, quotes, inspections, punch lists, deliveries, route sheets, timesheets, client lists. Send the sheet and describe the job; you'll get a straight answer in 48 hours.",
  ],
  [
    "Can I ask for something specific, like a map?",
    "Yes, and you should. Tick it on the form or describe it in your own words. Map pins, photos on an entry, signatures, barcode scanning and price totals are all standard. Anything else gets a yes or a no - never a maybe.",
  ],
  [
    "What if a standard build isn't the right shape for my job?",
    "Then we build you something custom instead: $299 once, then the same $10 a month. Standard setup is currently waived. We tell you which one you need before you pay for either.",
  ],
  [
    "Why is it this cheap?",
    "No salespeople, no ads, no self-serve builder to maintain. Software does the heavy lifting; a person does the finish work.",
  ],
  [
    "What happens if I fill 25 GB?",
    "That's years away for most teams - photos are the only thing that adds up. If you get there, it's +$10 a month per extra 25 GB, and we'll tell you before it matters.",
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
