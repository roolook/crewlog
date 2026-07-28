"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Check, Arrow } from "@/components/Icon";
import { c, f, stamp } from "@/lib/theme";
import { dateStamp } from "@/lib/format";
import { supabaseBrowser } from "@/lib/supabase/client";
import {
  addIntakePhone,
  createUploadTarget,
  submitIntake,
  type IntakeResult,
} from "./actions";

const ACCEPT = ".xlsx,.xls,.csv,.numbers,.zip,.pdf,image/*";

export function StartForm() {
  const [file, setFile] = useState<File | null>(null);
  const [byEmail, setByEmail] = useState(false);
  const [fileStamp, setFileStamp] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Extract<IntakeResult, { ok: true }> | null>(
    null,
  );
  const [confStamp, setConfStamp] = useState(false);
  const [phone, setPhone] = useState("");
  const [texted, setTexted] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const label = byEmail
    ? "(sending by email — build@crewlog.app)"
    : (file?.name ?? "");
  const attached = byEmail || !!file;
  const ready = attached && name.trim() && email.trim().includes("@") && !busy;

  function take(f: File | null) {
    if (!f) return;
    setFile(f);
    setByEmail(false);
    setError(null);
    setFileStamp(false);
    setTimeout(() => setFileStamp(true), 80);
  }

  function emailLater() {
    setFile(null);
    setByEmail(true);
    setError(null);
    setFileStamp(false);
    setTimeout(() => setFileStamp(true), 80);
  }

  async function submit() {
    if (!ready) return;
    setBusy(true);
    setError(null);

    try {
      let filePath: string | null = null;

      if (file) {
        setProgress("Uploading your sheet…");
        const target = await createUploadTarget(file.name);
        if (!target.ok) {
          setError(target.error);
          setBusy(false);
          setProgress(null);
          return;
        }
        const { error: upErr } = await supabaseBrowser()
          .storage.from("intake")
          .uploadToSignedUrl(target.path, target.token, file);
        if (upErr) {
          setError(
            `That upload didn't finish (${upErr.message}). You can email the sheet to build@crewlog.app instead.`,
          );
          setBusy(false);
          setProgress(null);
          return;
        }
        filePath = target.path;
      }

      setProgress("Filing the work order…");
      const res = await submitIntake({
        name,
        email,
        notes,
        filePath,
        fileName: file?.name ?? null,
        fileSize: file?.size ?? null,
        byEmail,
      });

      if (!res.ok) {
        setError(res.error);
        setBusy(false);
        setProgress(null);
        return;
      }

      setDone(res);
      window.scrollTo(0, 0);
      setTimeout(() => setConfStamp(true), 500);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Something went wrong. Email build@crewlog.app.",
      );
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  // ── confirmation ──────────────────────────────────────────────────────────

  if (done) {
    return (
      <>
        <div
          style={{
            background: c.paper,
            border: `1px solid ${c.line}`,
            borderRadius: 3,
            boxShadow: `0 2px 0 ${c.line}`,
            display: "flex",
            marginTop: 12,
          }}
        >
          <div
            style={{
              width: 26,
              flexShrink: 0,
              borderRight: `1px dashed ${c.line}`,
              backgroundImage:
                "radial-gradient(circle at 50% 50%, #EDEBE6 5px, transparent 5.5px)",
              backgroundSize: "100% 30px",
            }}
          />
          <div
            style={{
              flex: 1,
              padding: "28px 26px 32px",
              position: "relative",
              minWidth: 0,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                flexWrap: "wrap",
                gap: 8,
                borderBottom: `2px solid ${c.ink}`,
                paddingBottom: 12,
                marginBottom: 20,
              }}
            >
              <div
                style={{ fontFamily: f.display, fontWeight: 900, fontSize: 24 }}
              >
                WORK ORDER
              </div>
              <div style={{ fontFamily: f.mono, fontSize: 12, color: c.muted }}>
                {done.workOrder} · {dateStamp()}
              </div>
            </div>

            {[
              ["FILE", done.fileName],
              ["FROM", done.name],
              ["SEND TO", done.email],
            ].map(([k, v], i) => (
              <div
                key={k}
                style={{
                  fontFamily: f.mono,
                  fontSize: 13,
                  color: c.body,
                  borderBottom: `1px solid ${c.lineFaint}`,
                  padding: "10px 2px",
                  marginBottom: i === 2 ? 26 : 0,
                  display: "flex",
                  gap: 12,
                }}
              >
                <span style={{ flex: "0 0 66px", color: c.muted }}>{k}</span>
                <span
                  style={{
                    minWidth: 0,
                    overflowWrap: "anywhere",
                  }}
                >
                  {v}
                </span>
              </div>
            ))}

            <p
              style={{
                fontSize: 18,
                lineHeight: 1.55,
                margin: "0 0 10px",
                fontWeight: 600,
                maxWidth: "26em",
              }}
            >
              You&apos;ll get one email within 48 hours: &ldquo;Your app is
              ready.&rdquo; That&apos;s it. Nothing to set up in the meantime.
            </p>
            <p
              style={{
                fontSize: 14,
                color: c.muted,
                fontStyle: "italic",
                margin: 0,
              }}
            >
              Built by hand, in the order received.
            </p>

            {!texted ? (
              <div
                style={{
                  marginTop: 22,
                  borderTop: `1px solid ${c.lineFaint}`,
                  paddingTop: 18,
                }}
              >
                <div
                  style={{
                    fontFamily: f.mono,
                    fontSize: 11,
                    letterSpacing: "0.08em",
                    color: c.muted,
                    marginBottom: 8,
                  }}
                >
                  WANT A TEXT THE MINUTE IT&apos;S LIVE?{" "}
                  <span style={{ color: c.faint }}>(OPTIONAL)</span>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(555) 014-2288"
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: 16,
                      padding: "13px 12px",
                      border: `1px solid ${c.line}`,
                      borderRadius: 5,
                      background: "#FFF",
                      fontFamily: f.mono,
                    }}
                  />
                  <button
                    onClick={async () => {
                      if (!phone.trim()) return;
                      await addIntakePhone(done.email, phone);
                      setTexted(true);
                    }}
                    className="cl-btn-dark"
                    style={{
                      background: c.ink,
                      color: c.paper,
                      border: "none",
                      fontFamily: f.display,
                      fontWeight: 700,
                      fontSize: 14,
                      padding: "0 16px",
                      borderRadius: 5,
                      cursor: "pointer",
                    }}
                  >
                    Text me
                  </button>
                </div>
              </div>
            ) : (
              <div
                style={{
                  marginTop: 22,
                  borderTop: `1px solid ${c.lineFaint}`,
                  paddingTop: 18,
                  fontFamily: f.mono,
                  fontSize: 13,
                  color: c.green,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Check color={c.green} size={13} />
                We&apos;ll text {phone} the minute it&apos;s live
              </div>
            )}

            <div
              style={stamp(confStamp, c.orange, {
                top: 70,
                right: 22,
                fontSize: 18,
                padding: "5px 14px",
              })}
              aria-hidden
            >
              RECEIVED
            </div>
          </div>
        </div>
        <div style={{ marginTop: 26, fontSize: 14, color: c.muted }}>
          <Link href="/">← Back to crewlog.app</Link>
        </div>
      </>
    );
  }

  // ── the form ──────────────────────────────────────────────────────────────

  return (
    <div>
      <h1
        style={{
          fontFamily: f.display,
          fontWeight: 900,
          fontSize: "clamp(36px, 7vw, 54px)",
          margin: "0 0 12px",
          letterSpacing: "-0.01em",
        }}
      >
        Hand it over.
      </h1>
      <p
        style={{
          fontSize: 18,
          color: c.body,
          lineHeight: 1.55,
          margin: "0 0 34px",
        }}
      >
        Attach the sheet, tell us where to send the app. We do the rest.
      </p>

      <div
        style={{
          fontFamily: f.mono,
          fontSize: 12,
          letterSpacing: "0.1em",
          color: c.muted,
          marginBottom: 10,
        }}
      >
        1 / THE SPREADSHEET
      </div>

      {!attached ? (
        <>
          <label
            className="cl-dashed"
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              take(e.dataTransfer.files?.[0] ?? null);
            }}
            style={{
              display: "block",
              border: `2px dashed ${dragging ? c.orange : c.faint}`,
              borderRadius: 6,
              background: c.paper,
              padding: "38px 24px",
              textAlign: "center",
              cursor: "pointer",
            }}
          >
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              onChange={(e) => take(e.target.files?.[0] ?? null)}
              style={{ display: "none" }}
            />
            <div style={{ fontSize: 18, fontWeight: 600 }}>
              Drop it here or tap to attach
            </div>
            <div
              style={{
                fontFamily: f.mono,
                fontSize: 12,
                color: c.muted,
                marginTop: 8,
              }}
            >
              .xlsx · .csv · a zip of three sheets · a photo of the whiteboard
            </div>
          </label>
          <button
            onClick={emailLater}
            style={{
              background: "none",
              border: "none",
              fontSize: 14,
              color: c.muted,
              cursor: "pointer",
              textDecoration: "underline",
              marginTop: 10,
              padding: "4px 0",
              fontFamily: f.sans,
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
            }}
          >
            Don&apos;t have it handy? I&apos;ll email it after
            <Arrow size={13} color={c.muted} />
          </button>
        </>
      ) : (
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            gap: 12,
            border: `2px solid ${c.ink}`,
            borderRadius: 6,
            background: c.paper,
            padding: "18px 20px",
          }}
        >
          <div
            style={{
              fontFamily: f.mono,
              fontSize: 14,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flex: 1,
            }}
          >
            {label}
          </div>
          <button
            onClick={() => {
              setFile(null);
              setByEmail(false);
              setFileStamp(false);
              if (inputRef.current) inputRef.current.value = "";
            }}
            style={{
              background: "none",
              border: "none",
              fontSize: 13,
              color: c.muted,
              cursor: "pointer",
              textDecoration: "underline",
              flexShrink: 0,
            }}
          >
            remove
          </button>
          <div
            style={stamp(fileStamp, c.orange, {
              top: -14,
              right: 70,
              fontSize: 14,
              padding: "2px 8px",
            })}
            aria-hidden
          >
            RECEIVED
          </div>
        </div>
      )}

      <div
        style={{
          fontSize: 14,
          color: c.muted,
          margin: "10px 0 34px",
          fontStyle: "italic",
        }}
      >
        Messy is fine. Three spreadsheets is fine. Send all of it.
      </div>

      <div
        style={{
          fontFamily: f.mono,
          fontSize: 12,
          letterSpacing: "0.1em",
          color: c.muted,
          marginBottom: 10,
        }}
      >
        2 / WHERE THE APP GOES
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Field label="YOUR NAME">
          <input
            type="text"
            value={name}
            autoComplete="name"
            onChange={(e) => setName(e.target.value)}
            style={fieldInput}
          />
        </Field>
        <Field label="EMAIL">
          <input
            type="email"
            value={email}
            autoComplete="email"
            onChange={(e) => setEmail(e.target.value)}
            style={fieldInput}
          />
        </Field>
        <Field label="ANYTHING WE SHOULD KNOW?" optional>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. the 'location' column is truck numbers"
            style={{ ...fieldInput, fontSize: 16, resize: "vertical" }}
          />
        </Field>
      </div>

      <button
        onClick={submit}
        disabled={!ready}
        className={ready ? "cl-btn-orange" : undefined}
        style={{
          display: "block",
          width: "100%",
          marginTop: 28,
          background: c.orange,
          color: c.paper,
          border: "none",
          fontFamily: f.display,
          fontWeight: 700,
          fontSize: 18,
          padding: 18,
          borderRadius: 5,
          cursor: ready ? "pointer" : "not-allowed",
          opacity: ready ? 1 : 0.45,
          transition: "opacity 0.2s ease",
        }}
      >
        {busy
          ? (progress ?? "Sending…")
          : "Send it — free preview in 48 hours"}
      </button>

      {error ? (
        <div
          style={{
            marginTop: 10,
            fontSize: 14,
            color: c.red,
            background: "#FDECEA",
            border: `1px solid ${c.red}`,
            borderRadius: 5,
            padding: "10px 12px",
          }}
          role="alert"
        >
          {error}
        </div>
      ) : (
        <div
          style={{
            fontSize: 14,
            color: c.muted,
            marginTop: 10,
            fontStyle: "italic",
          }}
        >
          {ready
            ? "Free preview. No card, no account."
            : "Attach the sheet and add your name + email, and this lights up."}
        </div>
      )}

      <div
        style={{
          marginTop: 44,
          border: `1px solid ${c.line}`,
          borderRadius: 6,
          background: c.band,
          padding: "20px 22px",
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
          Prefer email?
        </div>
        <div style={{ fontSize: 16, color: c.body, lineHeight: 1.5 }}>
          Send it to{" "}
          <a
            href="mailto:build@crewlog.app"
            style={{ fontFamily: f.mono, fontSize: 14 }}
          >
            build@crewlog.app
          </a>{" "}
          — same 48 hours.
        </div>
      </div>
    </div>
  );
}

const fieldInput: React.CSSProperties = {
  fontSize: 18,
  padding: "15px 14px",
  border: `1px solid ${c.line}`,
  borderRadius: 5,
  background: c.paper,
  fontFamily: f.sans,
  width: "100%",
  boxSizing: "border-box",
};

function Field({
  label,
  optional,
  children,
}: {
  label: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span
        style={{
          fontFamily: f.mono,
          fontSize: 11,
          letterSpacing: "0.08em",
          color: c.muted,
        }}
      >
        {label}{" "}
        {optional && <span style={{ color: c.faint }}>(OPTIONAL)</span>}
      </span>
      {children}
    </label>
  );
}
