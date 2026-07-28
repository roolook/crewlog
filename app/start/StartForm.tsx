"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Check, Arrow } from "@/components/Icon";
import { c, f } from "@/lib/theme";
import { dateStamp } from "@/lib/format";
import { supabaseBrowser } from "@/lib/supabase/client";
import { CAPABILITIES, INTAKE_PROMPTS } from "@/lib/capabilities";
import {
  addIntakePhone,
  createUploadTarget,
  submitIntake,
  type IntakeResult,
  type UploadedFile,
} from "./actions";

/** No accept filter: "send all of it" has to mean all of it. */
const MAX_FILES = 10;
const MAX_BYTES = 50 * 1024 * 1024;

type Picked = { file: File; id: string };

export function StartForm() {
  const [picked, setPicked] = useState<Picked[]>([]);
  const [byEmail, setByEmail] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [capabilities, setCapabilities] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Extract<IntakeResult, { ok: true }> | null>(
    null,
  );
  const [phone, setPhone] = useState("");
  const [texted, setTexted] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const attached = byEmail || picked.length > 0;
  const ready = attached && name.trim() && email.trim().includes("@") && !busy;

  function take(list: FileList | File[] | null) {
    if (!list) return;
    const incoming = Array.from(list);
    if (incoming.length === 0) return;

    const tooBig = incoming.find((f) => f.size > MAX_BYTES);
    if (tooBig) {
      setError(
        `${tooBig.name} is over 50 MB. Email that one to build@crewlog.app and we'll take it from there.`,
      );
      return;
    }

    setError(null);
    setByEmail(false);
    setPicked((prev) => {
      // Same name and size twice is a double-pick, not two files.
      const seen = new Set(prev.map((p) => `${p.file.name}:${p.file.size}`));
      const fresh = incoming
        .filter((f) => !seen.has(`${f.name}:${f.size}`))
        .map((f) => ({ file: f, id: `${f.name}:${f.size}:${Math.random()}` }));
      return [...prev, ...fresh].slice(0, MAX_FILES);
    });
  }

  function emailLater() {
    setPicked([]);
    setByEmail(true);
    setError(null);
  }

  function toggleCapability(id: string) {
    setCapabilities((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function submit() {
    if (!ready) return;
    setBusy(true);
    setError(null);

    try {
      const uploaded: UploadedFile[] = [];

      for (let i = 0; i < picked.length; i++) {
        const { file } = picked[i];
        setProgress(
          picked.length === 1
            ? "Uploading…"
            : `Uploading ${i + 1} of ${picked.length}…`,
        );

        const target = await createUploadTarget(file.name);
        if (!target.ok) {
          setError(target.error);
          return;
        }
        const { error: upErr } = await supabaseBrowser()
          .storage.from("intake")
          .uploadToSignedUrl(target.path, target.token, file);
        if (upErr) {
          setError(
            `${file.name} didn't finish uploading (${upErr.message}). You can email it to build@crewlog.app instead.`,
          );
          return;
        }
        uploaded.push({
          path: target.path,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || undefined,
        });
      }

      setProgress("Filing the work order…");
      const res = await submitIntake({
        name,
        email,
        files: uploaded,
        capabilities,
        answers,
        byEmail,
      });

      if (!res.ok) {
        setError(res.error);
        return;
      }

      setDone(res);
      window.scrollTo(0, 0);
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
    const fileLine =
      done.fileNames.length === 0
        ? "(sending by email - build@crewlog.app)"
        : done.fileNames.length === 1
          ? done.fileNames[0]
          : `${done.fileNames.length} files - ${done.fileNames.join(", ")}`;

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
              ["FILES", fileLine],
              ["FROM", done.name],
              ["SEND TO", done.email],
              ...(done.requestCount > 0
                ? ([
                    [
                      "ASKED FOR",
                      `${done.requestCount} ${done.requestCount === 1 ? "thing" : "things"} - noted`,
                    ],
                  ] as [string, string][])
                : []),
            ].map(([k, v], i, all) => (
              <div
                key={k}
                style={{
                  fontFamily: f.mono,
                  fontSize: 13,
                  color: c.body,
                  borderBottom: `1px solid ${c.lineFaint}`,
                  padding: "10px 2px",
                  marginBottom: i === all.length - 1 ? 26 : 0,
                  display: "flex",
                  gap: 12,
                }}
              >
                <span style={{ flex: "0 0 76px", color: c.muted }}>{k}</span>
                <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{v}</span>
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
              {done.requestCount > 0 &&
                " We'll tell you straight which of your asks we can build."}
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
        Send whatever you&apos;ve got and tell us what it needs to do. A person
        reads all of it.
      </p>

      <SectionLabel n="1" text="WHAT YOU'VE GOT" />

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
              take(e.dataTransfer.files);
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
              multiple
              onChange={(e) => take(e.target.files)}
              style={{ display: "none" }}
            />
            <div style={{ fontSize: 18, fontWeight: 600 }}>
              Drop it here or tap to attach
            </div>
            <div
              style={{
                fontFamily: f.mono,
                fontSize: 13,
                color: c.muted,
                marginTop: 8,
              }}
            >
              spreadsheets · photos of the whiteboard · the paper form as a PDF ·
              a screenshot of what you use now
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
              gap: 6,
            }}
          >
            Don&apos;t have it handy? I&apos;ll email it after
            <Arrow size={12} color={c.muted} />
          </button>
        </>
      ) : (
        <div>
          <div
            style={{
              position: "relative",
              border: `2px solid ${c.ink}`,
              borderRadius: 6,
              background: c.paper,
              padding: byEmail ? "18px 20px" : "8px 8px",
            }}
          >
            {byEmail ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  fontFamily: f.mono,
                  fontSize: 14,
                }}
              >
                <span style={{ flex: 1 }}>
                  (sending by email - build@crewlog.app)
                </span>
                <button
                  onClick={() => {
                    setByEmail(false);
                  }}
                  style={removeBtn}
                >
                  remove
                </button>
              </div>
            ) : (
              picked.map((p) => (
                <div
                  key={p.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 12px",
                    borderBottom: `1px solid ${c.lineHair}`,
                  }}
                >
                  <div
                    style={{
                      fontFamily: f.mono,
                      fontSize: 13,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      flex: 1,
                    }}
                    title={p.file.name}
                  >
                    {p.file.name}
                  </div>
                  <div
                    style={{
                      fontFamily: f.mono,
                      fontSize: 11,
                      color: c.faint,
                      flexShrink: 0,
                    }}
                  >
                    {formatBytes(p.file.size)}
                  </div>
                  <button
                    onClick={() =>
                      setPicked((prev) => prev.filter((x) => x.id !== p.id))
                    }
                    style={removeBtn}
                  >
                    remove
                  </button>
                </div>
              ))
            )}

            {!byEmail && picked.length < MAX_FILES && (
              <button
                onClick={() => inputRef.current?.click()}
                style={{
                  background: "none",
                  border: "none",
                  fontFamily: f.mono,
                  fontSize: 13,
                  color: c.orangeDark,
                  cursor: "pointer",
                  padding: "12px",
                  textDecoration: "underline",
                }}
              >
                + add another file
              </button>
            )}
            <input
              ref={inputRef}
              type="file"
              multiple
              onChange={(e) => take(e.target.files)}
              style={{ display: "none" }}
            />

          </div>
        </div>
      )}

      <div
        style={{
          fontSize: 13,
          color: c.muted,
          margin: "10px 0 34px",
          fontStyle: "italic",
        }}
      >
        Messy is fine. Three spreadsheets and a photo is fine. Send all of it.
      </div>

      {/* ── what it should do ── */}
      <SectionLabel n="2" text="WHAT IT SHOULD DO" />
      <p
        style={{
          fontSize: 16,
          color: c.body,
          lineHeight: 1.55,
          margin: "0 0 16px",
          maxWidth: "34em",
        }}
      >
        Tick anything you want. We&apos;ll tell you straight which parts we can
        build - and if something isn&apos;t on this list, say so below.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))",
          gap: 8,
          marginBottom: 20,
        }}
      >
        {CAPABILITIES.map((cap) => {
          const on = capabilities.includes(cap.id);
          return (
            <button
              key={cap.id}
              onClick={() => toggleCapability(cap.id)}
              aria-pressed={on}
              style={{
                textAlign: "left",
                cursor: "pointer",
                background: on ? c.ink : c.paper,
                color: on ? c.paper : c.ink,
                border: `1px solid ${on ? c.ink : c.line}`,
                borderRadius: 4,
                padding: "12px 14px",
                fontFamily: f.sans,
                display: "flex",
                gap: 10,
                alignItems: "flex-start",
              }}
            >
              <span
                style={{
                  width: 16,
                  height: 16,
                  flexShrink: 0,
                  marginTop: 2,
                  borderRadius: 2,
                  border: `1.5px solid ${on ? c.paper : c.line}`,
                  background: on ? c.orange : "transparent",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                aria-hidden
              >
                {on && <Check size={11} color={c.paper} weight={3} />}
              </span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontWeight: 600, fontSize: 14 }}>
                  {cap.label}
                </span>
                <span
                  style={{
                    display: "block",
                    fontSize: 13,
                    marginTop: 2,
                    color: on ? "rgba(251,250,247,0.75)" : c.muted,
                    lineHeight: 1.4,
                  }}
                >
                  {cap.detail}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div
        style={{ display: "flex", flexDirection: "column", gap: 18, marginBottom: 34 }}
      >
        {INTAKE_PROMPTS.map((prompt) => (
          <label
            key={prompt.id}
            style={{ display: "flex", flexDirection: "column", gap: 6 }}
          >
            <span style={{ fontSize: 16, fontWeight: 600, color: c.ink }}>
              {prompt.label}
            </span>
            <textarea
              rows={3}
              value={answers[prompt.id] ?? ""}
              onChange={(e) =>
                setAnswers((prev) => ({ ...prev, [prompt.id]: e.target.value }))
              }
              placeholder={prompt.placeholder}
              style={{
                fontSize: 16,
                padding: "13px 14px",
                border: `1px solid ${c.line}`,
                borderRadius: 5,
                background: c.paper,
                fontFamily: f.sans,
                width: "100%",
                boxSizing: "border-box",
                resize: "vertical",
                lineHeight: 1.5,
              }}
            />
          </label>
        ))}
      </div>

      {/* ── where it goes ── */}
      <SectionLabel n="3" text="WHERE THE APP GOES" />
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
        {busy ? (progress ?? "Sending…") : "Send it - free preview in 48 hours"}
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
            fontSize: 13,
            color: c.muted,
            marginTop: 10,
            fontStyle: "italic",
          }}
        >
          {ready
            ? "Free preview. No card, no account."
            : "Attach something and add your name + email, and this lights up. The rest is optional."}
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
          - same 48 hours.
        </div>
      </div>
    </div>
  );
}

const removeBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  fontSize: 13,
  color: c.muted,
  cursor: "pointer",
  textDecoration: "underline",
  flexShrink: 0,
};

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

function SectionLabel({ n, text }: { n: string; text: string }) {
  return (
    <div
      style={{
        fontFamily: f.mono,
        fontSize: 12,
        letterSpacing: "0.1em",
        color: c.muted,
        marginBottom: 10,
      }}
    >
      {n} / {text}
    </div>
  );
}

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
        {label} {optional && <span style={{ color: c.faint }}>(OPTIONAL)</span>}
      </span>
      {children}
    </label>
  );
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
