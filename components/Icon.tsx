/**
 * The two marks the site actually needs, as SVG.
 *
 * These replace the bare "✓" and "→" characters that used to stand in for
 * icons. Glyph fallbacks render at a different weight and baseline on every
 * platform, and next to Archivo they read as placeholder. Drawn with a square
 * cap and a 2px stroke to match the hard 2px rules the rest of the layout uses.
 */

type IconProps = {
  size?: number;
  /** stroke weight — 2 matches the card borders, 2.5 for standalone marks */
  weight?: number;
  color?: string;
  style?: React.CSSProperties;
};

/** Ticked-off mark for spec lists and completed states. */
export function Check({ size = 14, weight = 2.5, color = "currentColor", style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      focusable="false"
      style={{ flexShrink: 0, display: "block", ...style }}
    >
      <path
        d="M2.5 8.5 6 12l7.5-8"
        stroke={color}
        strokeWidth={weight}
        strokeLinecap="square"
      />
    </svg>
  );
}

/** Forward mark for terms lists and CTA links. */
export function Arrow({ size = 14, weight = 2, color = "currentColor", style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      focusable="false"
      style={{ flexShrink: 0, display: "block", ...style }}
    >
      <path d="M1.5 8h12" stroke={color} strokeWidth={weight} strokeLinecap="square" />
      <path d="M9 3.5 13.5 8 9 12.5" stroke={color} strokeWidth={weight} strokeLinecap="square" />
    </svg>
  );
}
