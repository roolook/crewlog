/**
 * Every colour, weight and border in the CrewLog design system.
 *
 * The design files are pure inline styles, and the look depends on exact
 * values — the paper cream, the single-pixel rules, the offset hard shadows.
 * Rather than approximate them in a utility framework, the components below
 * consume these tokens directly so the port stays pixel-faithful.
 */

export const c = {
  /** page background — warm paper */
  bg: "#EDEBE6",
  /** raised surfaces: cards, sheets, inputs */
  paper: "#FBFAF7",
  /** table headers, inset strips */
  paperAlt: "#F2F0EA",
  /** banded sections */
  band: "#E4E1D9",

  ink: "#17181B",
  body: "#34342F",
  muted: "#6E6C66",
  faint: "#9B998F",

  orange: "#F4551E",
  orangeDark: "#D8430F",
  orangeBg: "#FDEDE5",

  green: "#1F8F4E",
  greenBg: "#E8F5EC",
  red: "#B3261E",

  line: "#C9C6BD",
  lineSoft: "#D8D5CC",
  lineFaint: "#E4E1D9",
  lineHair: "#EFEDE6",
} as const;

export const f = {
  display: "var(--font-archivo), Archivo, sans-serif",
  sans: "var(--font-plex-sans), 'IBM Plex Sans', sans-serif",
  mono: "var(--font-plex-mono), 'IBM Plex Mono', monospace",
} as const;

/** The hard offset shadow that gives cards their printed-form feel. */
export const shadow = {
  card: "5px 5px 0 rgba(23,24,27,0.08)",
  cardDark: "5px 5px 0 rgba(23,24,27,0.15)",
  button: "4px 4px 0 #17181B",
  buttonSm: "3px 3px 0 #17181B",
  hairline: "0 1px 0 #C9C6BD",
  hairline2: "0 2px 0 #C9C6BD",
  phone: "0 18px 40px rgba(23,24,27,0.25)",
  phoneLg: "0 22px 48px rgba(23,24,27,0.28)",
} as const;

/** Monospace eyebrow label — used above almost every section. */
export const eyebrow = (extra?: React.CSSProperties): React.CSSProperties => ({
  fontFamily: f.mono,
  fontSize: 13,
  letterSpacing: "0.12em",
  color: c.muted,
  ...extra,
});

export const btn = {
  primary: (extra?: React.CSSProperties): React.CSSProperties => ({
    background: c.orange,
    color: c.paper,
    border: "none",
    textDecoration: "none",
    fontFamily: f.display,
    fontWeight: 700,
    fontSize: 17,
    padding: "16px 26px",
    borderRadius: 4,
    cursor: "pointer",
    display: "inline-block",
    ...extra,
  }),
  dark: (extra?: React.CSSProperties): React.CSSProperties => ({
    background: c.ink,
    color: c.paper,
    border: "none",
    textDecoration: "none",
    fontFamily: f.display,
    fontWeight: 700,
    fontSize: 15,
    padding: "14px 22px",
    borderRadius: 4,
    cursor: "pointer",
    display: "inline-block",
    ...extra,
  }),
  quiet: (extra?: React.CSSProperties): React.CSSProperties => ({
    background: c.paper,
    color: c.body,
    border: `1px solid ${c.body}`,
    fontFamily: f.sans,
    fontSize: 16,
    padding: "0 20px",
    borderRadius: 2,
    cursor: "pointer",
    minHeight: 64,
    ...extra,
  }),
} as const;

export const input = (extra?: React.CSSProperties): React.CSSProperties => ({
  fontSize: 18,
  padding: "15px 14px",
  border: `1px solid ${c.line}`,
  borderRadius: 5,
  background: c.paper,
  fontFamily: f.sans,
  color: c.ink,
  width: "100%",
  boxSizing: "border-box",
  ...extra,
});

/**
 * The rubber-stamp overlay (RECEIVED, IN BUILD, ACTIVE…). `on` drives the
 * slam-down animation; multiply blending makes it read as ink on paper.
 */
export const stamp = (
  on: boolean,
  color: string,
  extra?: React.CSSProperties,
): React.CSSProperties => ({
  position: "absolute",
  fontFamily: f.display,
  fontWeight: 900,
  letterSpacing: "0.05em",
  color,
  border: `3px solid ${color}`,
  borderRadius: 2,
  padding: "3px 10px",
  pointerEvents: "none",
  background: "rgba(251,250,247,0.7)",
  mixBlendMode: "multiply",
  transform: on ? "rotate(-2deg) scale(1)" : "rotate(-2deg) scale(2.1)",
  opacity: on ? 0.88 : 0,
  transition:
    "transform 0.3s cubic-bezier(0.2,1.4,0.4,1), opacity 0.18s ease-out",
  ...extra,
});
