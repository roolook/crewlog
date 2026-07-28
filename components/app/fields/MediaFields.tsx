"use client";

import { useEffect, useRef, useState } from "react";
import { c, f } from "@/lib/theme";
import { asFile } from "@/lib/fields";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { FieldValue } from "@/lib/types";

/**
 * Photo, signature, barcode and rating.
 *
 * Photos and signatures go straight from the browser into the `entry-photos`
 * bucket under `<tenant_id>/…`, which is exactly the prefix the storage policy
 * checks - so a member can upload to their own tenant and nowhere else, and the
 * file never passes through a server action.
 */

function objectPath(tenantId: string, fieldKey: string, ext: string) {
  return `${tenantId}/${fieldKey}/${crypto.randomUUID()}.${ext}`;
}

/** Signed URL for a private object. Short-lived; refetched on mount. */
function useSignedUrl(path: string | undefined) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!path) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    supabaseBrowser()
      .storage.from("entry-photos")
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (!cancelled) setUrl(data?.signedUrl ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [path]);

  return url;
}

// ── photo ───────────────────────────────────────────────────────────────────

export function PhotoField({
  value,
  onChange,
  tenantId,
  fieldKey,
}: {
  value: FieldValue;
  onChange: (v: FieldValue) => void;
  tenantId: string;
  fieldKey: string;
}) {
  const file = asFile(value);
  const url = useSignedUrl(file?.path);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(picked: File | null) {
    if (!picked) return;
    setBusy(true);
    setError(null);
    try {
      const ext = (picked.name.split(".").pop() ?? "jpg").toLowerCase();
      const path = objectPath(tenantId, fieldKey, ext.slice(0, 5));
      const { error: upErr } = await supabaseBrowser()
        .storage.from("entry-photos")
        .upload(path, picked, { contentType: picked.type || "image/jpeg" });
      if (upErr) {
        setError(upErr.message);
        return;
      }
      onChange({ path });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {file ? (
        <div
          style={{
            border: `1px solid ${c.body}`,
            borderRadius: 2,
            background: "#FFF",
            overflow: "hidden",
          }}
        >
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt="Attached photo"
              style={{ display: "block", width: "100%", maxHeight: 260, objectFit: "cover" }}
            />
          ) : (
            <div
              style={{
                padding: 24,
                textAlign: "center",
                fontFamily: f.mono,
                fontSize: 12,
                color: c.muted,
              }}
            >
              loading…
            </div>
          )}
          <div style={{ display: "flex", gap: 14, padding: "10px 12px" }}>
            <button type="button" onClick={() => inputRef.current?.click()} style={linkBtn}>
              replace
            </button>
            <button type="button" onClick={() => onChange(null)} style={linkBtn}>
              remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          style={bigButton}
        >
          {busy ? "Uploading…" : "Take or choose a photo"}
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => upload(e.target.files?.[0] ?? null)}
        style={{ display: "none" }}
      />
      {error && (
        <div style={{ fontSize: 13, color: c.red }} role="alert">
          {error}
        </div>
      )}
    </div>
  );
}

// ── signature ───────────────────────────────────────────────────────────────

export function SignatureField({
  value,
  onChange,
  tenantId,
  fieldKey,
}: {
  value: FieldValue;
  onChange: (v: FieldValue) => void;
  tenantId: string;
  fieldKey: string;
}) {
  const file = asFile(value);
  const url = useSignedUrl(file?.path);
  const [drawing, setDrawing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (file && !drawing) {
    return (
      <div
        style={{
          border: `1px solid ${c.body}`,
          borderRadius: 2,
          background: "#FFF",
          padding: 10,
        }}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt="Signature"
            style={{ display: "block", width: "100%", maxHeight: 140, objectFit: "contain" }}
          />
        ) : (
          <div style={{ fontFamily: f.mono, fontSize: 12, color: c.muted }}>
            loading…
          </div>
        )}
        <div style={{ display: "flex", gap: 14, marginTop: 8 }}>
          <button type="button" onClick={() => setDrawing(true)} style={linkBtn}>
            sign again
          </button>
          <button type="button" onClick={() => onChange(null)} style={linkBtn}>
            clear
          </button>
        </div>
      </div>
    );
  }

  if (!drawing) {
    return (
      <button type="button" onClick={() => setDrawing(true)} style={bigButton}>
        Sign here
      </button>
    );
  }

  return (
    <SignaturePad
      busy={busy}
      error={error}
      onCancel={() => setDrawing(false)}
      onSave={async (blob) => {
        setBusy(true);
        setError(null);
        try {
          const path = objectPath(tenantId, fieldKey, "png");
          const { error: upErr } = await supabaseBrowser()
            .storage.from("entry-photos")
            .upload(path, blob, { contentType: "image/png" });
          if (upErr) {
            setError(upErr.message);
            return;
          }
          onChange({ path });
          setDrawing(false);
        } finally {
          setBusy(false);
        }
      }}
    />
  );
}

/** A canvas that takes finger or stylus input at device pixel ratio. */
function SignaturePad({
  onSave,
  onCancel,
  busy,
  error,
}: {
  onSave: (blob: Blob) => void;
  onCancel: () => void;
  busy: boolean;
  error: string | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#17181B";
  }, []);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <canvas
        ref={canvasRef}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          const ctx = e.currentTarget.getContext("2d");
          if (!ctx) return;
          const { x, y } = pos(e);
          ctx.beginPath();
          ctx.moveTo(x, y);
          drawing.current = true;
          setDirty(true);
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const ctx = e.currentTarget.getContext("2d");
          if (!ctx) return;
          const { x, y } = pos(e);
          ctx.lineTo(x, y);
          ctx.stroke();
        }}
        onPointerUp={() => {
          drawing.current = false;
        }}
        style={{
          width: "100%",
          height: 160,
          background: "#FFF",
          border: `1px solid ${c.body}`,
          borderRadius: 2,
          touchAction: "none",
          display: "block",
        }}
      />
      <div style={{ display: "flex", gap: 10 }}>
        <button
          type="button"
          onClick={() => {
            const canvas = canvasRef.current;
            const ctx = canvas?.getContext("2d");
            if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
            setDirty(false);
          }}
          style={{ ...smallButton, flex: "0 0 auto" }}
        >
          Clear
        </button>
        <button type="button" onClick={onCancel} style={{ ...smallButton, flex: "0 0 auto" }}>
          Cancel
        </button>
        <button
          type="button"
          disabled={!dirty || busy}
          onClick={() =>
            canvasRef.current?.toBlob((blob) => blob && onSave(blob), "image/png")
          }
          className={dirty && !busy ? "cl-btn-orange" : undefined}
          style={{
            flex: 1,
            minHeight: 48,
            background: c.orange,
            color: c.paper,
            border: "none",
            borderRadius: 2,
            fontFamily: f.display,
            fontWeight: 900,
            fontSize: 15,
            letterSpacing: "0.04em",
            cursor: dirty && !busy ? "pointer" : "not-allowed",
            opacity: dirty && !busy ? 1 : 0.45,
          }}
        >
          {busy ? "SAVING…" : "USE THIS SIGNATURE"}
        </button>
      </div>
      {error && (
        <div style={{ fontSize: 13, color: c.red }} role="alert">
          {error}
        </div>
      )}
    </div>
  );
}

// ── barcode ─────────────────────────────────────────────────────────────────

type BarcodeDetectorLike = {
  detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
};

/**
 * Uses the browser's own BarcodeDetector where it exists (Android Chrome), and
 * falls back to typing - which is what the field replaced anyway, so the
 * fallback is never a dead end.
 */
export function BarcodeField({
  value,
  onChange,
}: {
  value: FieldValue;
  onChange: (v: FieldValue) => void;
}) {
  const [scanning, setScanning] = useState(false);
  const [supported, setSupported] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    setSupported(
      typeof window !== "undefined" && "BarcodeDetector" in window,
    );
  }, []);

  useEffect(() => {
    if (!scanning) return;
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;

    (async () => {
      try {
        const Ctor = (
          window as unknown as {
            BarcodeDetector: new (o?: unknown) => BarcodeDetectorLike;
          }
        ).BarcodeDetector;
        const detector = new Ctor();
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        const tick = async () => {
          if (stopped || !videoRef.current) return;
          try {
            const found = await detector.detect(videoRef.current);
            if (found[0]?.rawValue) {
              onChange(found[0].rawValue);
              setScanning(false);
              return;
            }
          } catch {
            // A frame that can't be decoded is normal; keep looking.
          }
          raf = requestAnimationFrame(() => void tick());
        };
        void tick();
      } catch {
        setScanning(false);
      }
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [scanning, onChange]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {scanning && (
        <div style={{ position: "relative" }}>
          <video
            ref={videoRef}
            playsInline
            muted
            style={{
              width: "100%",
              maxHeight: 240,
              objectFit: "cover",
              background: c.ink,
              borderRadius: 2,
            }}
          />
          <button
            type="button"
            onClick={() => setScanning(false)}
            style={{
              ...smallButton,
              position: "absolute",
              top: 8,
              right: 8,
            }}
          >
            Stop
          </button>
        </div>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Scan or type the code"
          style={{
            flex: 1,
            minWidth: 0,
            fontFamily: f.mono,
            fontSize: 16,
            padding: "16px 14px",
            border: `1px solid ${c.body}`,
            borderRadius: 2,
            background: "#FFF",
            boxSizing: "border-box",
          }}
        />
        {supported && !scanning && (
          <button
            type="button"
            onClick={() => setScanning(true)}
            style={{ ...smallButton, minHeight: 56, flex: "0 0 auto" }}
          >
            Scan
          </button>
        )}
      </div>
      {!supported && (
        <div style={{ fontSize: 13, color: c.muted, fontStyle: "italic" }}>
          This browser can&apos;t use the camera to scan - typing works the same.
        </div>
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

const bigButton: React.CSSProperties = {
  minHeight: 56,
  background: "#FFF",
  border: `1px solid ${c.body}`,
  borderRadius: 2,
  fontFamily: f.sans,
  fontSize: 16,
  fontWeight: 600,
  cursor: "pointer",
  padding: "0 18px",
  width: "100%",
};

const smallButton: React.CSSProperties = {
  background: c.paper,
  border: `1px solid ${c.body}`,
  borderRadius: 2,
  fontFamily: f.sans,
  fontSize: 14,
  fontWeight: 600,
  padding: "10px 14px",
  cursor: "pointer",
};
