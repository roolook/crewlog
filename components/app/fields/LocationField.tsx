"use client";

import { useEffect, useRef, useState } from "react";
import { c, f } from "@/lib/theme";
import { asLocation, formatCoords, mapsUrl } from "@/lib/fields";
import type { FieldValue, LocationValue } from "@/lib/types";

/**
 * Tap the field, get a map, drop a pin where it actually is.
 *
 * MapLibre is imported dynamically inside the component, so a tenant with no
 * location field never downloads it — the map bundle is ~230 KB and most
 * customers don't have one of these.
 *
 * With no NEXT_PUBLIC_MAPTILER_KEY there are no tiles to draw, so the field
 * degrades rather than breaking: it still captures the phone's GPS, still takes
 * a typed description, and still hands the coordinates to whatever map app the
 * phone already has. Capturing the pin is the part that matters; rendering it
 * is a nicety.
 */
export function LocationField({
  value,
  onChange,
  label,
}: {
  value: FieldValue;
  onChange: (v: FieldValue) => void;
  label: string;
}) {
  const loc = asLocation(value);
  const [open, setOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const hasTiles = !!process.env.NEXT_PUBLIC_MAPTILER_KEY;

  function useMyLocation() {
    if (!navigator.geolocation) {
      setNote("This phone won't share its location.");
      return;
    }
    setLocating(true);
    setNote(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        onChange({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          label: loc?.label,
        });
      },
      (err) => {
        setLocating(false);
        setNote(
          err.code === err.PERMISSION_DENIED
            ? "Location permission was denied — you can still type where it is."
            : "Couldn't get a fix. Type where it is instead.",
        );
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {loc ? (
        <div
          style={{
            border: `1px solid ${c.body}`,
            borderRadius: 2,
            background: "#FFF",
            padding: "12px 14px",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <div style={{ fontFamily: f.mono, fontSize: 13, color: c.ink }}>
            {formatCoords(loc)}
          </div>
          {loc.label && (
            <div style={{ fontSize: 14, color: c.body }}>{loc.label}</div>
          )}
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 2 }}>
            <button type="button" onClick={() => setOpen(true)} style={linkBtn}>
              {hasTiles ? "move the pin" : "edit"}
            </button>
            <a
              href={mapsUrl(loc)}
              target="_blank"
              rel="noreferrer"
              style={{ ...linkBtn, textDecoration: "underline" }}
            >
              open in Maps
            </a>
            <button type="button" onClick={() => onChange(null)} style={linkBtn}>
              clear
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setOpen(true)}
            style={{
              flex: "1 1 auto",
              minHeight: 56,
              background: "#FFF",
              border: `1px solid ${c.body}`,
              borderRadius: 2,
              fontFamily: f.sans,
              fontSize: 16,
              fontWeight: 600,
              cursor: "pointer",
              padding: "0 18px",
            }}
          >
            {hasTiles ? "Pin it on a map" : `Set ${label.toLowerCase()}`}
          </button>
          <button
            type="button"
            onClick={useMyLocation}
            disabled={locating}
            style={{
              flex: "0 0 auto",
              minHeight: 56,
              background: c.ink,
              color: c.paper,
              border: "none",
              borderRadius: 2,
              fontFamily: f.sans,
              fontSize: 15,
              fontWeight: 600,
              cursor: locating ? "wait" : "pointer",
              padding: "0 16px",
            }}
          >
            {locating ? "Locating…" : "Use my location"}
          </button>
        </div>
      )}

      {note && (
        <div style={{ fontSize: 13, color: c.orangeDark }} role="status">
          {note}
        </div>
      )}

      {open && (
        <LocationPicker
          initial={loc}
          hasTiles={hasTiles}
          label={label}
          onCancel={() => setOpen(false)}
          onSave={(next) => {
            onChange(next);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

const linkBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  padding: 0,
  fontFamily: f.mono,
  fontSize: 12,
  color: c.muted,
  cursor: "pointer",
  textDecoration: "underline",
};

/** Full-screen sheet: the map (if we have tiles) plus a description field. */
function LocationPicker({
  initial,
  hasTiles,
  label,
  onSave,
  onCancel,
}: {
  initial: LocationValue | null;
  hasTiles: boolean;
  label: string;
  onSave: (v: LocationValue) => void;
  onCancel: () => void;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(
    initial ? { lat: initial.lat, lng: initial.lng } : null,
  );
  const [text, setText] = useState(initial?.label ?? "");
  const [mapError, setMapError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!hasTiles || !holder.current) return;
    let map: import("maplibre-gl").Map | null = null;
    let marker: import("maplibre-gl").Marker | null = null;
    let cancelled = false;

    (async () => {
      try {
        // Dynamic import: nothing here is in the bundle unless a map opens.
        const maplibre = await import("maplibre-gl");
        if (cancelled || !holder.current) return;

        const key = process.env.NEXT_PUBLIC_MAPTILER_KEY;
        map = new maplibre.Map({
          container: holder.current,
          style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${key}`,
          center: initial ? [initial.lng, initial.lat] : [-98.5795, 39.8283],
          zoom: initial ? 16 : 3,
          attributionControl: { compact: true },
        });
        map.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
        map.addControl(
          new maplibre.GeolocateControl({
            positionOptions: { enableHighAccuracy: true },
            trackUserLocation: false,
          }),
          "top-right",
        );

        const place = (lng: number, lat: number) => {
          setPin({ lat, lng });
          if (!map) return;
          if (marker) marker.setLngLat([lng, lat]);
          else {
            marker = new maplibre.Marker({ color: "#F4551E", draggable: true })
              .setLngLat([lng, lat])
              .addTo(map);
            marker.on("dragend", () => {
              const p = marker!.getLngLat();
              setPin({ lat: p.lat, lng: p.lng });
            });
          }
        };

        if (initial) place(initial.lng, initial.lat);
        map.on("click", (e) => place(e.lngLat.lng, e.lngLat.lat));
        map.on("load", () => !cancelled && setReady(true));
        map.on("error", (e) => {
          // A bad key or a blocked request shouldn't strand the operator.
          setMapError(
            "The map wouldn't load. You can still use your location or type it.",
          );
          console.error("maplibre", e?.error ?? e);
        });
      } catch (e) {
        setMapError("The map wouldn't load. Type where it is instead.");
        console.error(e);
      }
    })();

    return () => {
      cancelled = true;
      marker?.remove();
      map?.remove();
    };
  }, [hasTiles, initial]);

  const canSave = pin !== null;

  return (
    <div
      role="dialog"
      aria-label={`Set ${label}`}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: c.bg,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          flexShrink: 0,
          background: c.paper,
          borderBottom: `2px solid ${c.ink}`,
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ fontFamily: f.display, fontWeight: 900, fontSize: 16 }}>
          {label.toUpperCase()}
        </div>
        <button type="button" onClick={onCancel} style={linkBtn}>
          cancel
        </button>
      </div>

      {hasTiles && !mapError ? (
        <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
          <div ref={holder} style={{ position: "absolute", inset: 0 }} />
          {!ready && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: f.mono,
                fontSize: 13,
                color: c.muted,
                background: c.bg,
              }}
            >
              loading the map…
            </div>
          )}
          {ready && !pin && (
            <div
              style={{
                position: "absolute",
                left: 12,
                right: 12,
                top: 12,
                background: "rgba(23,24,27,0.86)",
                color: c.paper,
                fontFamily: f.mono,
                fontSize: 12,
                padding: "8px 10px",
                borderRadius: 3,
                pointerEvents: "none",
              }}
            >
              tap the map to drop a pin
            </div>
          )}
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0, padding: 16, overflowY: "auto" }}>
          {mapError && (
            <div
              style={{
                background: c.orangeBg,
                border: `1px solid ${c.orangeDark}`,
                borderRadius: 4,
                padding: "10px 12px",
                fontSize: 14,
                color: c.body,
                marginBottom: 14,
              }}
            >
              {mapError}
            </div>
          )}
          <ManualCoords pin={pin} onPin={setPin} />
        </div>
      )}

      <div
        style={{
          flexShrink: 0,
          background: c.paper,
          borderTop: `1px solid ${c.line}`,
          padding: 14,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Describe it — e.g. behind the loading dock"
          style={{
            fontSize: 16,
            padding: "13px 12px",
            border: `1px solid ${c.line}`,
            borderRadius: 2,
            background: "#FFF",
            fontFamily: f.sans,
            width: "100%",
            boxSizing: "border-box",
          }}
        />
        <div
          style={{ display: "flex", justifyContent: "space-between", gap: 12 }}
        >
          <span style={{ fontFamily: f.mono, fontSize: 12, color: c.muted }}>
            {pin ? formatCoords({ ...pin }) : "no pin yet"}
          </span>
          <button
            type="button"
            disabled={!canSave}
            onClick={() =>
              pin && onSave({ ...pin, label: text.trim() || undefined })
            }
            className={canSave ? "cl-btn-orange" : undefined}
            style={{
              background: c.orange,
              color: c.paper,
              border: "none",
              fontFamily: f.display,
              fontWeight: 900,
              fontSize: 15,
              letterSpacing: "0.04em",
              padding: "14px 22px",
              borderRadius: 2,
              cursor: canSave ? "pointer" : "not-allowed",
              opacity: canSave ? 1 : 0.45,
            }}
          >
            USE THIS SPOT
          </button>
        </div>
      </div>
    </div>
  );
}

/** No-tiles fallback: GPS button plus typed coordinates. */
function ManualCoords({
  pin,
  onPin,
}: {
  pin: { lat: number; lng: number } | null;
  onPin: (p: { lat: number; lng: number }) => void;
}) {
  const [lat, setLat] = useState(pin ? String(pin.lat) : "");
  const [lng, setLng] = useState(pin ? String(pin.lng) : "");
  const [busy, setBusy] = useState(false);

  function commit(nextLat: string, nextLng: string) {
    const a = Number(nextLat);
    const b = Number(nextLng);
    if (Number.isFinite(a) && Number.isFinite(b) && a >= -90 && a <= 90) {
      onPin({ lat: a, lng: b });
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          navigator.geolocation?.getCurrentPosition(
            (pos) => {
              setBusy(false);
              setLat(String(pos.coords.latitude));
              setLng(String(pos.coords.longitude));
              onPin({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            },
            () => setBusy(false),
            { enableHighAccuracy: true, timeout: 10000 },
          );
        }}
        style={{
          minHeight: 56,
          background: c.ink,
          color: c.paper,
          border: "none",
          borderRadius: 2,
          fontFamily: f.sans,
          fontSize: 16,
          fontWeight: 600,
          cursor: busy ? "wait" : "pointer",
        }}
      >
        {busy ? "Locating…" : "Use my current location"}
      </button>

      <div style={{ display: "flex", gap: 10 }}>
        {(
          [
            ["LATITUDE", lat, setLat] as const,
            ["LONGITUDE", lng, setLng] as const,
          ]
        ).map(([label, val, set]) => (
          <label
            key={label}
            style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}
          >
            <span
              style={{
                fontFamily: f.mono,
                fontSize: 11,
                letterSpacing: "0.08em",
                color: c.muted,
              }}
            >
              {label}
            </span>
            <input
              inputMode="decimal"
              value={val}
              onChange={(e) => {
                set(e.target.value);
                commit(
                  label === "LATITUDE" ? e.target.value : lat,
                  label === "LONGITUDE" ? e.target.value : lng,
                );
              }}
              style={{
                fontFamily: f.mono,
                fontSize: 15,
                padding: "12px",
                border: `1px solid ${c.line}`,
                borderRadius: 2,
                background: "#FFF",
                width: "100%",
                boxSizing: "border-box",
              }}
            />
          </label>
        ))}
      </div>
    </div>
  );
}
