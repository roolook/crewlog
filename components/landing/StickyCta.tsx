"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { c, f } from "@/lib/theme";

/**
 * Mobile-only bar that slides up once the hero scrolls away. It hides itself
 * whenever a field has focus, so it never covers the on-screen keyboard.
 */
export function StickyCta({ watch = "[data-hero]" }: { watch?: string }) {
  const [isMobile, setIsMobile] = useState(false);
  const [heroVisible, setHeroVisible] = useState(true);
  const [kbOpen, setKbOpen] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => setIsMobile(mq.matches);
    mq.addEventListener("change", sync);
    sync();

    const hero = document.querySelector(watch);
    let io: IntersectionObserver | undefined;
    if (hero) {
      io = new IntersectionObserver(
        (entries) =>
          entries.forEach((e) => setHeroVisible(e.isIntersecting)),
        { threshold: 0 },
      );
      io.observe(hero);
    }

    const onFocusIn = (e: FocusEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) setKbOpen(true);
    };
    const onFocusOut = () => setKbOpen(false);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);

    return () => {
      mq.removeEventListener("change", sync);
      io?.disconnect();
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, [watch]);

  const on = isMobile && !heroVisible && !kbOpen;

  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 60,
        background: c.orange,
        padding: "10px 14px calc(10px + env(safe-area-inset-bottom, 0px))",
        boxShadow: "0 -4px 16px rgba(23,24,27,0.18)",
        display: isMobile ? "block" : "none",
        transform: on ? "translateY(0)" : "translateY(120%)",
        transition: "transform 0.25s ease",
        pointerEvents: on ? "auto" : "none",
      }}
      aria-hidden={!on}
    >
      <Link
        href="/start"
        className="cl-btn-dark"
        style={{
          display: "block",
          textAlign: "center",
          background: c.ink,
          color: c.paper,
          textDecoration: "none",
          fontFamily: f.display,
          fontWeight: 700,
          fontSize: 16,
          padding: "15px 20px",
          borderRadius: 4,
        }}
      >
        Send my spreadsheet →
      </Link>
    </div>
  );
}
