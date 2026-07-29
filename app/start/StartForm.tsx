"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { c, f } from "@/lib/theme";
import { CAPABILITIES, INTAKE_PROMPTS } from "@/lib/capabilities";
import {
  cleanupUploadedFiles,
  createUploadTarget,
  submitIntake,
  type IntakeResult,
  type UploadedFile,
} from "./actions";

const MAX_FILES = 10;
const MAX_BYTES = 50 * 1024 * 1024;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Picked = { file: File; id: string };
type FieldErrors = Partial<
  Record<"company" | "files" | "name" | "email" | "answers" | "somethingElse", string>
>;

export function StartForm() {
  const [workOrderRef, setWorkOrderRef] = useState("");
  const [company, setCompany] = useState("");
  const [picked, setPicked] = useState<Picked[]>([]);
  const [byEmail, setByEmail] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [capabilities, setCapabilities] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [done, setDone] = useState<Extract<IntakeResult, { ok: true }> | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setWorkOrderRef(
      `CL-${crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`,
    );
  }, []);

  const emailFilesHref = `mailto:build@crewlog.app?subject=${encodeURIComponent(
    `${workOrderRef || "CrewLog brief"} - files`,
  )}`;

  function validate() {
    const next: FieldErrors = {};
    if (!company.trim()) next.company = "Add the company name.";
    if (!byEmail && picked.length === 0) {
      next.files = "Attach at least one file or choose to send the files by email.";
    }
    if (!name.trim()) next.name = "Add your name.";
    if (!EMAIL_RE.test(email.trim())) next.email = "Enter a complete email address.";
    if (INTAKE_PROMPTS.some((prompt) => !answers[prompt.id]?.trim())) {
      next.answers = "Answer all three workflow questions.";
    }
    if (
      capabilities.includes("something_else") &&
      !answers.something_else?.trim()
    ) {
      next.somethingElse = "Describe what else the app should handle.";
    }
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  function take(list: FileList | File[] | null) {
    if (!list) return;
    const incoming = Array.from(list);
    if (!incoming.length) return;
    const tooBig = incoming.find((file) => file.size > MAX_BYTES);
    if (tooBig) {
      setFieldErrors((prev) => ({
        ...prev,
        files: `${tooBig.name} is over the 50 MB per-file limit.`,
      }));
      return;
    }
    if (picked.length + incoming.length > MAX_FILES) {
      setFieldErrors((prev) => ({
        ...prev,
        files: `You can attach up to ${MAX_FILES} files. Remove one before adding more.`,
      }));
      return;
    }

    const seen = new Set(picked.map((item) => `${item.file.name}:${item.file.size}`));
    const fresh = incoming
      .filter((file) => !seen.has(`${file.name}:${file.size}`))
      .map((file) => ({
        file,
        id: `${file.name}:${file.size}:${crypto.randomUUID()}`,
      }));
    setPicked((prev) => [...prev, ...fresh]);
    setByEmail(false);
    setFieldErrors((prev) => ({ ...prev, files: undefined }));
  }

  function toggleCapability(id: string) {
    setCapabilities((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id],
    );
  }

  async function submit() {
    if (busy || !validate()) {
      setError("Check the highlighted fields before sending your brief.");
      return;
    }
    setBusy(true);
    setError(null);
    const uploaded: UploadedFile[] = [];

    try {
      for (let index = 0; index < picked.length; index += 1) {
        const file = picked[index].file;
        setProgress(
          picked.length === 1
            ? "Uploading your file…"
            : `Uploading file ${index + 1} of ${picked.length}…`,
        );
        const target = await createUploadTarget(file.name);
        if (!target.ok) {
          await cleanupUploadedFiles(uploaded);
          setError(target.error);
          return;
        }
        const candidate: UploadedFile = {
          path: target.path,
          cleanupToken: target.cleanupToken,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || undefined,
        };
        const { error: uploadError } = await supabaseUpload(
          target.path,
          target.token,
          file,
        );
        if (uploadError) {
          await cleanupUploadedFiles([...uploaded, candidate]);
          setError(
            `${file.name} did not finish uploading. Nothing was submitted. Try again or email the files.`,
          );
          return;
        }
        uploaded.push(candidate);
      }

      setProgress("Saving your brief…");
      const result = await submitIntake({
        companyName: company,
        workOrderRef,
        name,
        email,
        files: uploaded,
        capabilities,
        answers,
        byEmail,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDone(result);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (reason) {
      await cleanupUploadedFiles(uploaded);
      setError(
        reason instanceof Error
          ? reason.message
          : "The brief did not finish sending. Your answers are still here.",
      );
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  if (done) {
    const needsFiles = done.byEmail && done.fileNames.length === 0;
    return (
      <div style={confirmationCard}>
        <div style={eyebrow}>BRIEF RECEIVED · {done.workOrder}</div>
        <h1 style={confirmationHeading}>We have the brief for {done.companyName}.</h1>
        <SummaryRow label="Contact" value={`${done.name} · ${done.email}`} />
        <SummaryRow
          label="Files"
          value={
            needsFiles
              ? "Still needed before the 48-hour build starts"
              : done.fileNames.join(", ")
          }
        />
        <SummaryRow
          label="Requirements"
          value={`${done.requestCount} item${done.requestCount === 1 ? "" : "s"} recorded`}
        />
        {needsFiles ? (
          <div style={actionPanel}>
            <strong>One thing left: send the files.</strong>
            <p style={{ margin: "6px 0 14px", lineHeight: 1.5 }}>
              Put {done.workOrder} in the subject so the files attach to this brief.
              The 48-hour build starts when they arrive.
            </p>
            <a href={emailFilesHref} style={primaryLink}>
              Email the files
            </a>
          </div>
        ) : (
          <div style={actionPanel}>
            <strong>Your preview is due within 48 hours.</strong>
            <p style={{ margin: "6px 0 0", lineHeight: 1.5 }}>
              Reply to the confirmation email if anything in the brief changes.
            </p>
          </div>
        )}
        <Link href="/" style={{ display: "inline-block", marginTop: 22 }}>
          Back to crewlog.app
        </Link>
      </div>
    );
  }

  const selectedLabels = CAPABILITIES.filter((capability) =>
    capabilities.includes(capability.id),
  ).map((capability) => capability.label);

  return (
    <div>
      <h1 style={pageHeading}>Hand over the work, not a specification.</h1>
      <p style={pageIntro}>
        Send the material you use today and answer three practical questions. A
        person turns it into a working phone app.
      </p>

      {error && (
        <div role="alert" style={errorSummary}>
          {error}
        </div>
      )}

      <section aria-labelledby="starting-point">
        <SectionLabel n="1" id="starting-point" text="YOUR STARTING POINT" />
        <RequiredField
          id="company"
          label="Company name"
          error={fieldErrors.company}
        >
          <input
            id="company"
            value={company}
            onChange={(event) => {
              setCompany(event.target.value);
              setFieldErrors((prev) => ({ ...prev, company: undefined }));
            }}
            autoComplete="organization"
            aria-invalid={Boolean(fieldErrors.company)}
            aria-describedby={fieldErrors.company ? "company-error" : undefined}
            style={fieldInput}
          />
        </RequiredField>

        <div style={{ marginTop: 18 }}>
          <div style={fieldLabel}>FILES <RequiredMark /></div>
          {!byEmail && picked.length === 0 ? (
            <label
              className="cl-dashed"
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                take(event.dataTransfer.files);
              }}
              style={{
                ...dropZone,
                borderColor: fieldErrors.files
                  ? c.red
                  : dragging
                    ? c.orange
                    : c.faint,
              }}
            >
              <input
                ref={inputRef}
                type="file"
                multiple
                onChange={(event) => take(event.target.files)}
                style={{ position: "absolute", opacity: 0, pointerEvents: "none" }}
              />
              <strong style={{ fontSize: 18 }}>Drop files here or tap to attach</strong>
              <span style={dropHelp}>
                Up to 10 files · 50 MB each · spreadsheets, PDFs, photos and
                screenshots
              </span>
            </label>
          ) : byEmail ? (
            <div style={selectedFileBox}>
              <div>
                <strong>Files will arrive by email.</strong>
                <div style={{ color: c.muted, marginTop: 4, fontSize: 13 }}>
                  The build clock starts after they arrive.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setByEmail(false)}
                style={quietButton}
              >
                Attach here instead
              </button>
            </div>
          ) : (
            <div style={selectedFileBox}>
              <div style={{ flex: 1 }}>
                {picked.map((item) => (
                  <div key={item.id} style={fileRow}>
                    <span>{item.file.name}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${item.file.name}`}
                      onClick={() =>
                        setPicked((prev) => prev.filter((value) => value.id !== item.id))
                      }
                      style={quietButton}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              {picked.length < MAX_FILES && (
                <button type="button" onClick={() => inputRef.current?.click()} style={quietButton}>
                  Add files
                </button>
              )}
            </div>
          )}
          {fieldErrors.files && (
            <FieldError id="files-error">{fieldErrors.files}</FieldError>
          )}
          {!byEmail && picked.length === 0 && (
            <button
              type="button"
              onClick={() => {
                setByEmail(true);
                setFieldErrors((prev) => ({ ...prev, files: undefined }));
              }}
              style={{ ...quietButton, marginTop: 10 }}
            >
              I’ll send the files by email
            </button>
          )}
          {byEmail && (
            <a href={emailFilesHref} style={{ display: "inline-block", marginTop: 10 }}>
              Open the file email for {workOrderRef || "this brief"}
            </a>
          )}
        </div>
      </section>

      <section aria-labelledby="workflow" style={sectionGap}>
        <SectionLabel n="2" id="workflow" text="WHAT HAPPENS TODAY" />
        <p style={sectionIntro}>
          Plain language is best. These answers stay attached to their questions
          for the person building your app.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {INTAKE_PROMPTS.map((prompt) => (
            <label key={prompt.id} htmlFor={prompt.id} style={labelStack}>
              <span style={{ fontWeight: 700 }}>
                {prompt.label} <RequiredMark />
              </span>
              <textarea
                id={prompt.id}
                rows={3}
                value={answers[prompt.id] ?? ""}
                placeholder={prompt.placeholder}
                onChange={(event) => {
                  setAnswers((prev) => ({ ...prev, [prompt.id]: event.target.value }));
                  setFieldErrors((prev) => ({ ...prev, answers: undefined }));
                }}
                aria-invalid={Boolean(fieldErrors.answers)}
                style={textArea}
              />
            </label>
          ))}
        </div>
        {fieldErrors.answers && <FieldError id="answers-error">{fieldErrors.answers}</FieldError>}
      </section>

      <section aria-labelledby="extras" style={sectionGap}>
        <SectionLabel n="3" id="extras" text="OPTIONAL FEATURES" />
        <p style={sectionIntro}>
          Choose anything you may want in your app. You can skip this section.
        </p>
        <p style={extrasKey}>
          Included features fit the standard app. Custom build features may need
          extra work. We will confirm anything that depends on your files.
        </p>
        {(["Capture", "Workflow", "Output"] as const).map((group) => (
          <div key={group} style={{ marginTop: 18 }}>
            <div style={fieldLabel}>{group.toUpperCase()}</div>
            <div style={capabilityGrid}>
              {CAPABILITIES.filter((capability) => capability.group === group).map(
                (capability) => {
                  const selected = capabilities.includes(capability.id);
                  return (
                    <button
                      key={capability.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => toggleCapability(capability.id)}
                      style={{
                        ...capabilityButton,
                        background: selected ? c.ink : c.paper,
                        color: selected ? c.paper : c.ink,
                        borderColor: selected ? c.ink : c.line,
                      }}
                    >
                      <span style={capabilityTitle}>
                        <span>{capability.label}</span>
                        <span style={availabilityBadge(selected)}>
                          {capability.availability === "standard"
                            ? "INCLUDED"
                            : capability.availability === "custom"
                              ? "CUSTOM BUILD"
                              : "WE WILL CONFIRM"}
                        </span>
                      </span>
                      <span
                        style={{
                          color: selected ? c.line : c.muted,
                          lineHeight: 1.4,
                        }}
                      >
                        {capability.detail}
                      </span>
                    </button>
                  );
                },
              )}
            </div>
          </div>
        ))}
        {capabilities.includes("something_else") && (
          <label htmlFor="something_else" style={{ ...labelStack, marginTop: 18 }}>
            <span style={{ fontWeight: 700 }}>
              What else should it handle? <RequiredMark />
            </span>
            <textarea
              id="something_else"
              rows={3}
              value={answers.something_else ?? ""}
              onChange={(event) => {
                setAnswers((prev) => ({
                  ...prev,
                  something_else: event.target.value,
                }));
                setFieldErrors((prev) => ({
                  ...prev,
                  somethingElse: undefined,
                }));
              }}
              aria-invalid={Boolean(fieldErrors.somethingElse)}
              style={textArea}
            />
            {fieldErrors.somethingElse && (
              <FieldError id="something-else-error">
                {fieldErrors.somethingElse}
              </FieldError>
            )}
          </label>
        )}
      </section>

      <section aria-labelledby="contact-review" style={sectionGap}>
        <SectionLabel n="4" id="contact-review" text="WHERE SHOULD WE SEND YOUR PREVIEW?" />
        <div style={contactGrid}>
          <RequiredField id="name" label="Your name" error={fieldErrors.name}>
            <input
              id="name"
              value={name}
              autoComplete="name"
              onChange={(event) => {
                setName(event.target.value);
                setFieldErrors((prev) => ({ ...prev, name: undefined }));
              }}
              aria-invalid={Boolean(fieldErrors.name)}
              aria-describedby={fieldErrors.name ? "name-error" : undefined}
              style={fieldInput}
            />
          </RequiredField>
          <RequiredField id="email" label="Email" error={fieldErrors.email}>
            <input
              id="email"
              type="email"
              value={email}
              autoComplete="email"
              onChange={(event) => {
                setEmail(event.target.value);
                setFieldErrors((prev) => ({ ...prev, email: undefined }));
              }}
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? "email-error" : undefined}
              style={fieldInput}
            />
          </RequiredField>
        </div>

        <div style={reviewCard}>
          <div style={eyebrow}>REVIEW YOUR BRIEF</div>
          <SummaryRow label="Company" value={company || "Not added"} />
          <SummaryRow
            label="Files"
            value={
              byEmail
                ? `Sending separately · ${workOrderRef || "reference pending"}`
                : picked.length
                  ? `${picked.length} attached`
                  : "Not added"
            }
          />
          <SummaryRow
            label="Workflow"
            value={`${Object.values(answers).filter((value) => value.trim()).length} answers`}
          />
          <SummaryRow
            label="Extras"
            value={selectedLabels.length ? selectedLabels.join(", ") : "None selected"}
          />
          <SummaryRow label="Preview" value={email || "Email not added"} />
        </div>
      </section>

      <button
        type="button"
        onClick={submit}
        disabled={busy}
        className="cl-btn-orange"
        style={{
          ...submitButton,
          opacity: busy ? 0.65 : 1,
          cursor: busy ? "wait" : "pointer",
        }}
      >
        {busy ? progress || "Sending…" : "Send my brief"}
      </button>
      <div aria-live="polite" style={submitHelp}>
        {busy ? progress : "Free preview within 48 hours. No card or account."}
      </div>
    </div>
  );
}

async function supabaseUpload(path: string, token: string, file: File) {
  const { supabaseBrowser } = await import("@/lib/supabase/client");
  return supabaseBrowser().storage.from("intake").uploadToSignedUrl(path, token, file);
}

function SectionLabel({ n, id, text }: { n: string; id: string; text: string }) {
  return (
    <h2 id={id} style={sectionLabel}>
      {n} / {text}
    </h2>
  );
}

function RequiredMark() {
  return <span style={{ color: c.orangeDark }} aria-label="required">*</span>;
}

function RequiredField({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} style={fieldLabel}>
        {label.toUpperCase()} <RequiredMark />
      </label>
      {children}
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </div>
  );
}

function FieldError({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <div id={id} style={{ color: c.red, fontSize: 13, marginTop: 6 }}>
      {children}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={summaryRow}>
      <span style={{ color: c.muted }}>{label.toUpperCase()}</span>
      <span style={{ overflowWrap: "anywhere" }}>{value}</span>
    </div>
  );
}

const pageHeading: React.CSSProperties = {
  fontFamily: f.display,
  fontWeight: 900,
  fontSize: "clamp(34px, 7vw, 52px)",
  lineHeight: 1.02,
  margin: "0 0 14px",
};
const pageIntro: React.CSSProperties = {
  fontSize: 18,
  color: c.body,
  lineHeight: 1.55,
  margin: "0 0 34px",
  maxWidth: "34em",
};
const sectionGap: React.CSSProperties = { marginTop: 42 };
const sectionLabel: React.CSSProperties = {
  fontFamily: f.mono,
  fontSize: 13,
  letterSpacing: "0.08em",
  color: c.body,
  margin: "0 0 14px",
};
const sectionIntro: React.CSSProperties = {
  color: c.body,
  fontSize: 15,
  lineHeight: 1.5,
  margin: "0 0 16px",
};
const fieldLabel: React.CSSProperties = {
  display: "block",
  fontFamily: f.mono,
  fontSize: 12,
  letterSpacing: "0.06em",
  color: c.body,
  marginBottom: 7,
};
const fieldInput: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  minHeight: 48,
  fontSize: 17,
  padding: "12px 13px",
  border: `1px solid ${c.line}`,
  borderRadius: 5,
  background: c.paper,
};
const textArea: React.CSSProperties = {
  ...fieldInput,
  lineHeight: 1.5,
  resize: "vertical",
};
const labelStack: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 7,
};
const dropZone: React.CSSProperties = {
  position: "relative",
  display: "flex",
  flexDirection: "column",
  gap: 8,
  alignItems: "center",
  textAlign: "center",
  border: `2px dashed ${c.faint}`,
  borderRadius: 6,
  background: c.paper,
  padding: "32px 20px",
  cursor: "pointer",
};
const dropHelp: React.CSSProperties = {
  fontFamily: f.mono,
  fontSize: 12,
  color: c.muted,
  lineHeight: 1.5,
};
const selectedFileBox: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 14,
  flexWrap: "wrap",
  border: `1px solid ${c.line}`,
  borderRadius: 5,
  padding: 14,
  background: c.paper,
};
const fileRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  minHeight: 36,
  fontFamily: f.mono,
  fontSize: 12,
};
const quietButton: React.CSSProperties = {
  minHeight: 44,
  padding: "9px 6px",
  border: 0,
  background: "transparent",
  color: c.orangeDark,
  textDecoration: "underline",
  cursor: "pointer",
};
const extrasKey: React.CSSProperties = {
  maxWidth: "56em",
  margin: "8px 0 0",
  color: c.muted,
  fontSize: 13,
  lineHeight: 1.5,
};
const capabilityGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 8,
};
const capabilityButton: React.CSSProperties = {
  minHeight: 92,
  border: `1px solid ${c.line}`,
  borderRadius: 4,
  padding: 13,
  textAlign: "left",
  cursor: "pointer",
  fontSize: 13,
};
const capabilityTitle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  alignItems: "flex-start",
  marginBottom: 5,
  fontWeight: 700,
};
const availabilityBadge = (selected: boolean): React.CSSProperties => ({
  flexShrink: 0,
  fontFamily: f.mono,
  fontSize: 9,
  letterSpacing: "0.06em",
  color: selected ? c.line : c.muted,
});
const contactGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
  gap: 14,
};
const reviewCard: React.CSSProperties = {
  marginTop: 22,
  background: c.paper,
  border: `1px solid ${c.line}`,
  borderRadius: 5,
  padding: 16,
};
const eyebrow: React.CSSProperties = {
  fontFamily: f.mono,
  fontSize: 11,
  letterSpacing: "0.08em",
  color: c.orangeDark,
  marginBottom: 8,
};
const summaryRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "100px minmax(0, 1fr)",
  gap: 12,
  padding: "9px 0",
  borderBottom: `1px solid ${c.lineFaint}`,
  fontFamily: f.mono,
  fontSize: 12,
};
const submitButton: React.CSSProperties = {
  width: "100%",
  minHeight: 56,
  marginTop: 26,
  border: 0,
  borderRadius: 5,
  background: c.orange,
  color: c.paper,
  fontFamily: f.display,
  fontWeight: 700,
  fontSize: 18,
};
const submitHelp: React.CSSProperties = {
  minHeight: 22,
  marginTop: 9,
  textAlign: "center",
  color: c.muted,
  fontSize: 13,
};
const errorSummary: React.CSSProperties = {
  marginBottom: 20,
  padding: "11px 13px",
  border: `1px solid ${c.red}`,
  borderRadius: 5,
  background: "#FDECEA",
  color: c.red,
};
const confirmationCard: React.CSSProperties = {
  background: c.paper,
  border: `2px solid ${c.ink}`,
  borderRadius: 6,
  padding: "28px 24px",
};
const confirmationHeading: React.CSSProperties = {
  fontFamily: f.display,
  fontWeight: 900,
  fontSize: 30,
  lineHeight: 1.1,
  margin: "0 0 18px",
};
const actionPanel: React.CSSProperties = {
  marginTop: 22,
  padding: 16,
  border: `1px solid ${c.line}`,
  borderRadius: 5,
  background: c.bg,
};
const primaryLink: React.CSSProperties = {
  display: "inline-block",
  minHeight: 44,
  padding: "12px 16px",
  borderRadius: 4,
  background: c.ink,
  color: c.paper,
  textDecoration: "none",
  fontWeight: 700,
};
