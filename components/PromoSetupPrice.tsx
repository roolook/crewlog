import { c, f } from "@/lib/theme";
import { SETUP_LIST, SETUP_PROMO } from "@/lib/pricing";

export function PromoSetupPrice({
  compact = false,
  inverse = false,
}: {
  compact?: boolean;
  inverse?: boolean;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "baseline",
        gap: compact ? 5 : 8,
        whiteSpace: "nowrap",
      }}
      aria-label={`Setup is $${SETUP_PROMO}; regular price $${SETUP_LIST}`}
    >
      <strong
        style={{
          fontFamily: f.display,
          fontSize: compact ? "1em" : 20,
          color: inverse ? c.paper : c.orangeDark,
        }}
      >
        ${SETUP_PROMO}
      </strong>
      <del
        style={{
          fontFamily: f.mono,
          fontSize: compact ? "0.78em" : 12,
          color: inverse ? c.faint : c.muted,
          textDecorationThickness: 2,
        }}
        aria-hidden
      >
        ${SETUP_LIST}
      </del>
      <span style={{ fontSize: compact ? "0.86em" : 14 }}>setup</span>
    </span>
  );
}
