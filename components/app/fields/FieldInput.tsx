"use client";

import dynamic from "next/dynamic";
import { c, f } from "@/lib/theme";
import type { FieldValue, TenantField } from "@/lib/types";
import { RatingField } from "./RatingField";

/**
 * The capability widgets load on demand.
 *
 * Most tenants are a plain generated log with none of these columns, and they
 * shouldn't download a map picker, a camera scanner and a signature canvas to
 * render a text input. LocationField in particular pulls MapLibre, which is
 * larger than the entire rest of the app.
 *
 * ssr:false because all four are browser-only - canvas, camera, geolocation.
 */
const loading = () => (
  <div
    style={{
      minHeight: 56,
      display: "flex",
      alignItems: "center",
      fontFamily: f.mono,
      fontSize: 12,
      color: c.muted,
    }}
  >
    loading…
  </div>
);

const LocationField = dynamic(
  () => import("./LocationField").then((m) => m.LocationField),
  { ssr: false, loading },
);
const PhotoField = dynamic(
  () => import("./MediaFields").then((m) => m.PhotoField),
  { ssr: false, loading },
);
const SignatureField = dynamic(
  () => import("./MediaFields").then((m) => m.SignatureField),
  { ssr: false, loading },
);
const BarcodeField = dynamic(
  () => import("./MediaFields").then((m) => m.BarcodeField),
  { ssr: false, loading },
);

/**
 * One switch, so the form doesn't have to know how any individual field works.
 *
 * The inferred types (text/number/date/dropdown/boolean) render as they always
 * have. The capability types delegate to their own components - and because
 * LocationField imports MapLibre dynamically, a tenant with no location column
 * never pays for the map.
 */
export function FieldInput({
  field,
  value,
  onChange,
  tenantId,
  isTitle,
  chip,
  textInput,
}: {
  field: TenantField;
  value: FieldValue;
  onChange: (v: FieldValue) => void;
  tenantId: string;
  isTitle: boolean;
  /** The shell's chip renderer, so dropdowns keep matching the rest of the app. */
  chip: (label: string, active: boolean, onClick: () => void) => React.ReactNode;
  textInput: React.CSSProperties;
}) {
  switch (field.type) {
    case "dropdown":
      if (field.options.length === 0) break;
      return (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {field.options.map((opt) =>
            chip(opt, value === opt, () => onChange(opt)),
          )}
        </div>
      );

    case "boolean":
      return (
        <div style={{ display: "flex", gap: 8 }}>
          {[
            ["Yes", true],
            ["No", false],
          ].map(([label, val]) =>
            chip(String(label), value === val, () => onChange(val as boolean)),
          )}
        </div>
      );

    case "location":
      return (
        <LocationField value={value} onChange={onChange} label={field.label} />
      );

    case "photo":
      return (
        <PhotoField
          value={value}
          onChange={onChange}
          tenantId={tenantId}
          fieldKey={field.key}
        />
      );

    case "signature":
      return (
        <SignatureField
          value={value}
          onChange={onChange}
          tenantId={tenantId}
          fieldKey={field.key}
        />
      );

    case "barcode":
      return <BarcodeField value={value} onChange={onChange} />;

    case "rating":
      return (
        <RatingField value={value} onChange={onChange} options={field.options} />
      );

    case "long_text":
      return (
        <textarea
          rows={4}
          value={value === null || value === undefined ? "" : String(value)}
          onChange={(e) => onChange(e.target.value)}
          style={{ ...textInput, resize: "vertical", lineHeight: 1.5 }}
        />
      );

    case "currency":
      return (
        <div style={{ position: "relative" }}>
          <span
            style={{
              position: "absolute",
              left: 14,
              top: "50%",
              transform: "translateY(-50%)",
              fontFamily: f.mono,
              fontSize: 16,
              color: c.muted,
              pointerEvents: "none",
            }}
            aria-hidden
          >
            $
          </span>
          <input
            inputMode="decimal"
            value={value === null || value === undefined ? "" : String(value)}
            onChange={(e) => onChange(e.target.value.replace(/[^0-9.\-]/g, ""))}
            style={{ ...textInput, paddingLeft: 30, fontFamily: f.mono }}
          />
        </div>
      );
  }

  // text, number, date, and a dropdown with no options to pick from
  return (
    <input
      type={
        field.type === "date" ? "date" : field.type === "number" ? "number" : "text"
      }
      inputMode={field.type === "number" ? "decimal" : undefined}
      value={value === null || value === undefined ? "" : String(value)}
      onChange={(e) => onChange(e.target.value)}
      placeholder={isTitle ? `${field.label}…` : undefined}
      style={
        field.type === "date"
          ? { ...textInput, fontFamily: f.mono, fontSize: 18 }
          : textInput
      }
    />
  );
}
