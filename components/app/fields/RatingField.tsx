"use client";

import { c, f } from "@/lib/theme";
import type { FieldValue } from "@/lib/types";

/**
 * Deliberately in its own module rather than beside the photo and signature
 * fields: those import the Supabase browser client, and a static import of
 * anything in that file pulls supabase-js into the app shell's base bundle for
 * every tenant. Rating needs nothing, so it stays cheap and static.
 */

/** Discrete options when the operator set them (Pass/Fail), else 1–5. */
export function RatingField({
  value,
  onChange,
  options,
}: {
  value: FieldValue;
  onChange: (v: FieldValue) => void;
  options: string[];
}) {
  const choices: (string | number)[] =
    options.length > 0 ? options : [1, 2, 3, 4, 5];

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {choices.map((choice) => {
        const on = String(value) === String(choice);
        return (
          <button
            key={String(choice)}
            type="button"
            onClick={() => onChange(on ? null : choice)}
            style={{
              minWidth: options.length > 0 ? undefined : 56,
              minHeight: 56,
              padding: options.length > 0 ? "14px 18px" : undefined,
              borderRadius: 2,
              border: on ? `1.5px solid ${c.ink}` : `1px solid ${c.line}`,
              background: on ? c.ink : "#FFF",
              color: on ? c.paper : c.ink,
              fontFamily: f.sans,
              fontSize: 16,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {choice}
          </button>
        );
      })}
    </div>
  );
}
