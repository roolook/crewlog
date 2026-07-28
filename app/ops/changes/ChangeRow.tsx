"use client";

import { useState, useTransition } from "react";
import { c, f } from "@/lib/theme";
import { setChangeDone } from "./actions";

export function ChangeRow({
  id,
  text,
  meta,
  done: initialDone,
}: {
  id: string;
  text: string;
  meta: string;
  done: boolean;
}) {
  const [done, setDone] = useState(initialDone);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !done;
    setDone(next);
    startTransition(async () => {
      const res = await setChangeDone(id, next);
      if (!res.ok) setDone(!next);
    });
  }

  return (
    <div
      style={{
        display: "flex",
        gap: 16,
        alignItems: "center",
        background: c.paper,
        border: `1px solid ${done ? c.green : c.line}`,
        borderRadius: 4,
        padding: "14px 16px",
        opacity: done ? 0.55 : 1,
        transition: "opacity 0.2s ease, border-color 0.2s ease",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14.5 }}>{text}</div>
        <div
          style={{
            fontFamily: f.mono,
            fontSize: 11.5,
            color: c.muted,
            marginTop: 3,
          }}
        >
          {meta}
        </div>
      </div>
      <button
        onClick={toggle}
        disabled={pending}
        style={{
          flexShrink: 0,
          background: done ? c.greenBg : c.ink,
          color: done ? c.green : c.paper,
          border: "none",
          fontFamily: f.mono,
          fontSize: 11,
          padding: "9px 13px",
          borderRadius: 3,
          cursor: pending ? "wait" : "pointer",
        }}
      >
        {done ? "DONE ✓" : "MARK DONE"}
      </button>
    </div>
  );
}
