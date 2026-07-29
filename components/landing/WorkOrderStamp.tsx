"use client";

import { useEffect, useRef, useState } from "react";

export function WorkOrderStamp({
  children,
  delay,
}: {
  children: React.ReactNode;
  delay: number;
}) {
  const stampRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stamp = stampRef.current;
    if (!stamp) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reducedMotion || !("IntersectionObserver" in window)) {
      setVisible(true);
      return;
    }

    let timeout: number | undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        timeout = window.setTimeout(() => setVisible(true), delay);
      },
      { threshold: 0.5 },
    );
    observer.observe(stamp);

    return () => {
      observer.disconnect();
      if (timeout !== undefined) window.clearTimeout(timeout);
    };
  }, [delay]);

  return (
    <div
      ref={stampRef}
      className={`cl-work-order-stamp${visible ? " is-visible" : ""}`}
      aria-hidden="true"
    >
      {children}
    </div>
  );
}
