"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DEFAULT_APP_THEME, type AppTheme } from "@/lib/app-theme";
import type { AppBlueprint } from "@/lib/app-blueprint";
import { c, f } from "@/lib/theme";
import { slugify } from "@/lib/format";
import type { FieldType, IntakeSubmission, PlanTier } from "@/lib/types";
import { AttachmentsPanel, RequestsPanel } from "./BuildPanels";
import { generateApp, parseSubmission, type ColumnSpec } from "./actions";
import { ThemeWorkshop } from "./ThemeWorkshop";

const GRID = "1.2fr 0.9fr 0.5fr 0.5fr 1.5fr 0.5fr 0.5fr 0.4fr";
/** Inferred from the sheet, then the capability types an operator assigns. */
const TYPES: FieldType[] = [
  "text",
  "long_text",
  "number",
  "currency",
  "date",
  "dropdown",
  "boolean",
  "rating",
  "location",
  "photo",
  "signature",
  "barcode",
];

export function SchemaEditor({ submission }: { submission: IntakeSubmission }) {
  const [loading, setLoading] = useState(true);
  const [parseError, setParseError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string>("");
  const [columns, setColumns] = useState<ColumnSpec[]>([]);
  const [sample, setSample] = useState<Record<string, string>[]>([]);
  const [company, setCompany] = useState("");
  const [logLabel, setLogLabel] = useState("LOG");
  const [heroLabel, setHeroLabel] = useState("ITEMS OPEN RIGHT NOW");
  const [notify, setNotify] = useState(true);
  const [planTier, setPlanTier] = useState<PlanTier>("standard");
  const [customKey, setCustomKey] = useState("");
  const [theme, setTheme] = useState<AppTheme>(DEFAULT_APP_THEME);
  const [blueprint, setBlueprint] = useState<AppBlueprint | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    slug: string;
    previewUrl: string;
    imported: number;
    emailed: boolean;
  } | null>(null);

  // Seed the company name from the email domain, right about 80% of the time.
  useEffect(() => {
    const domain = submission.email.split("@")[1] ?? "";
    const guess = domain
      .replace(/\.(com|net|org|ca|co\.uk|io|app|example)$/i, "")
      .split(".")
      .pop();
    setCompany(
      /^(gmail|yahoo|hotmail|outlook|icloud|aol|proton|me)$/i.test(guess ?? "")
        ? submission.name
        : (guess ?? "").replace(/^\w/, (ch) => ch.toUpperCase()),
    );
  }, [submission.email, submission.name]);

  useEffect(() => {
    let cancelled = false;
    parseSubmission(submission.id)
      .then((res) => {
        if (cancelled) return;
        setLoading(false);
        if (!res.ok) {
          setParseError(res.error);
          setColumns([blankColumn(0, true)]);
          return;
        }
        setColumns(
          res.columns.map((col) => ({
            key: col.key,
            label: col.label,
            type: col.type,
            required: col.required,
            on_card: col.on_card,
            options: col.options,
            is_title: col.is_title,
            is_status: col.is_status,
          })),
        );
        setSample(res.sampleRows);
        setSummary(
          [
            `${res.rowCount} rows parsed`,
            `${res.columns.length} columns`,
            res.otherSheets.length
              ? `${res.otherSheets.length} more sheet(s): ${res.otherSheets.join(", ")}`
              : null,
          ]
            .filter(Boolean)
            .join(" · "),
        );
        const status = res.columns.find((col) => col.is_status);
        if (status) {
          setHeroLabel(`${status.options[0] ?? "OPEN"} RIGHT NOW`.toUpperCase());
        }
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setLoading(false);
        setParseError(
          reason instanceof Error
            ? reason.message
            : "The spreadsheet parser did not respond.",
        );
        setColumns([blankColumn(0, true)]);
      });
    return () => {
      cancelled = true;
    };
  }, [submission.id]);

  function patch(i: number, next: Partial<ColumnSpec>) {
    setColumns((prev) =>
      prev.map((col, j) => (j === i ? { ...col, ...next } : col)),
    );
  }

  function addCapabilityField(type: FieldType) {
    setColumns((prev) => {
      if (prev.some((column) => column.type === type)) return prev;
      const label = capabilityFieldLabel(type);
      const baseKey = slugify(label).replace(/-/g, "_");
      let key = baseKey;
      let suffix = 2;
      while (prev.some((column) => column.key === key)) {
        key = `${baseKey}_${suffix}`;
        suffix += 1;
      }
      return [
        ...prev,
        {
          key,
          label,
          type,
          required: false,
          on_card: false,
          options: [],
          is_title: false,
          is_status: false,
        },
      ];
    });
  }

  /** Title and status are exclusive. Setting one clears it everywhere else. */
  function setExclusive(i: number, which: "is_title" | "is_status") {
    setColumns((prev) =>
      prev.map((col, j) => ({
        ...col,
        [which]: j === i ? !col[which] : false,
      })),
    );
  }

  async function generate() {
    if (!company.trim()) {
      setError("Give the company a name. It becomes the URL and app header.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await generateApp({
        submissionId: submission.id,
        companyName: company,
        logLabel,
        heroLabel,
        columns,
        sendEmail: notify,
        planTier,
        customAppKey: customKey.trim() || null,
        theme,
        blueprint,
      });
      if (!res.ok) setError(res.error);
      else setResult(res);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "The build request did not complete.",
      );
    } finally {
      setBusy(false);
    }
  }

  // ── generated ─────────────────────────────────────────────────────────────

  if (result) {
    return (
      <div
        style={{
          background: c.paper,
          border: `2px solid ${c.green}`,
          borderRadius: 4,
          padding: "24px 26px",
          maxWidth: 720,
        }}
      >
        <div
          style={{
            fontFamily: f.display,
            fontWeight: 900,
            fontSize: 24,
            marginBottom: 8,
          }}
        >
          Built. {result.imported} rows in.
        </div>
        <p style={{ fontSize: 16, lineHeight: 1.55, color: c.body, margin: "0 0 16px" }}>
          {result.emailed
            ? `The "your app is ready" email went to ${submission.email}.`
            : `Nothing emailed yet. Send the preview link when you're ready.`}
        </p>

        <div
          style={{
            fontFamily: f.mono,
            fontSize: 12,
            background: c.bg,
            border: `1px solid ${c.line}`,
            borderRadius: 4,
            padding: "12px 14px",
            overflowWrap: "anywhere",
            marginBottom: 18,
          }}
        >
          {result.previewUrl}
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <a
            href={result.previewUrl}
            target="_blank"
            rel="noreferrer"
            style={{
              background: c.ink,
              color: c.paper,
              textDecoration: "none",
              fontFamily: f.display,
              fontWeight: 700,
              fontSize: 14,
              padding: "12px 18px",
              borderRadius: 4,
            }}
          >
            Open the preview ↗
          </a>
          <Link
            href="/ops"
            style={{
              background: c.paper,
              border: `1px solid ${c.ink}`,
              color: c.ink,
              textDecoration: "none",
              fontFamily: f.display,
              fontWeight: 700,
              fontSize: 14,
              padding: "12px 18px",
              borderRadius: 4,
            }}
          >
            Back to the inbox
          </Link>
        </div>
      </div>
    );
  }

  // ── editor ────────────────────────────────────────────────────────────────

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 14,
          marginBottom: 6,
          flexWrap: "wrap",
        }}
      >
        <h1
          style={{ fontFamily: f.display, fontWeight: 900, fontSize: 24, margin: 0 }}
        >
          Build: {submission.name}
        </h1>
        <div style={{ fontFamily: f.mono, fontSize: 12, color: c.muted }}>
          {submission.file_name ?? "no file"} ·{" "}
          {loading ? "parsing…" : summary || "manual schema"}
        </div>
      </div>
      <div
        style={{
          fontFamily: f.mono,
          fontSize: 12,
          color: c.muted,
          marginBottom: 18,
        }}
      >
        {submission.email}
        {submission.notes ? ` · note: “${submission.notes}”` : ""}
      </div>

      {parseError && (
        <div
          style={{
            background: c.orangeBg,
            border: `1px solid ${c.orangeDark}`,
            borderRadius: 4,
            padding: "12px 14px",
            fontSize: 14,
            color: c.body,
            marginBottom: 18,
            maxWidth: 760,
          }}
        >
          {parseError}
        </div>
      )}

      {/* ── what they sent and what they asked for ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 16,
          marginBottom: 20,
        }}
      >
        <AttachmentsPanel submissionId={submission.id} />
        <RequestsPanel
          submissionId={submission.id}
          existingTypes={columns.map((column) => column.type)}
          onAddField={addCapabilityField}
        />
      </div>

      {/* ── company + labels ── */}
      <div
        style={{
          display: "flex",
          gap: 16,
          flexWrap: "wrap",
          marginBottom: 20,
          background: c.paper,
          border: `1px solid ${c.line}`,
          borderRadius: 4,
          padding: "16px 18px",
        }}
      >
        <OpsField label="COMPANY NAME" hint={company ? `/app/${slugify(company)}` : " "}>
          <input
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            style={opsInput}
          />
        </OpsField>
        <OpsField label="LOG LABEL" hint="shown under the app header">
          <input
            value={logLabel}
            onChange={(e) => setLogLabel(e.target.value.toUpperCase())}
            style={{ ...opsInput, width: 160, fontFamily: f.mono }}
          />
        </OpsField>
        <OpsField label="TIER" hint="what they're being charged">
          <select
            value={planTier}
            onChange={(e) => setPlanTier(e.target.value as PlanTier)}
            style={{ ...opsInput, fontFamily: f.mono, fontSize: 12, width: 150 }}
          >
            <option value="standard">standard · $0 promo setup</option>
            <option value="custom">custom · $299</option>
          </select>
        </OpsField>
        <OpsField
          label="CUSTOM APP KEY"
          hint={customKey.trim() ? "serves a hand-built app" : "blank = generated"}
        >
          <input
            value={customKey}
            onChange={(e) =>
              setCustomKey(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
            }
            placeholder="none"
            style={{ ...opsInput, fontFamily: f.mono, fontSize: 12, width: 190 }}
          />
        </OpsField>
        <OpsField label="HERO METRIC LABEL" hint="the big number on the dash">
          <input
            value={heroLabel}
            onChange={(e) => setHeroLabel(e.target.value.toUpperCase())}
            style={{ ...opsInput, width: 260, fontFamily: f.mono, fontSize: 12 }}
          />
        </OpsField>
      </div>

      <ThemeWorkshop
        company={company}
        logLabel={logLabel}
        fields={columns.map((column) => ({
          key: column.key,
          label: column.label,
          type: column.type,
          required: column.required,
        }))}
        value={theme}
        onChange={setTheme}
        onBlueprintChange={setBlueprint}
      />

      {/* ── columns ── */}
      <div
        style={{
          background: c.paper,
          border: `1px solid ${c.line}`,
          borderRadius: 4,
          overflowX: "auto",
          marginBottom: 16,
        }}
      >
        <div style={{ minWidth: 980 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: GRID,
              fontFamily: f.mono,
              fontSize: 11,
              color: c.muted,
              borderBottom: `2px solid ${c.ink}`,
              background: c.paperAlt,
            }}
          >
            {[
              "COLUMN",
              "FIELD TYPE",
              "REQ",
              "CARD",
              "DROPDOWN OPTIONS (from sheet)",
              "TITLE",
              "STATUS",
              "",
            ].map((h, i) => (
              <div key={i} style={{ padding: "9px 12px" }}>
                {h}
              </div>
            ))}
          </div>

          {loading && (
            <div style={{ padding: "40px 14px", color: c.muted, fontSize: 14 }}>
              Reading the sheet…
            </div>
          )}

          {columns.map((col, i) => (
            <div
              key={`${col.key}-${i}`}
              style={{
                display: "grid",
                gridTemplateColumns: GRID,
                fontSize: 13,
                borderBottom: `1px solid ${c.lineFaint}`,
                alignItems: "center",
                background: col.is_title ? "#FFFDF7" : undefined,
              }}
            >
              <div style={{ padding: "6px 12px" }}>
                <input
                  value={col.label}
                  onChange={(e) =>
                    patch(i, {
                      label: e.target.value,
                      key: slugify(e.target.value).replace(/-/g, "_") || col.key,
                    })
                  }
                  style={{ ...opsInput, fontFamily: f.mono, fontWeight: 600 }}
                />
              </div>
              <div style={{ padding: "6px 12px" }}>
                <select
                  value={col.type}
                  onChange={(e) =>
                    patch(i, { type: e.target.value as FieldType })
                  }
                  style={{ ...opsInput, fontFamily: f.mono, fontSize: 12 }}
                >
                  {TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <Check
                checked={col.required}
                onChange={() => patch(i, { required: !col.required })}
                label={`${col.label} required`}
              />
              <Check
                checked={col.on_card}
                onChange={() => patch(i, { on_card: !col.on_card })}
                label={`${col.label} on card`}
              />
              <div style={{ padding: "6px 12px" }}>
                {col.type === "dropdown" ? (
                  <input
                    value={col.options.join(" · ")}
                    onChange={(e) =>
                      patch(i, {
                        options: e.target.value
                          .split("·")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                    style={{
                      ...opsInput,
                      fontFamily: f.mono,
                      fontSize: 12,
                      color: c.body,
                    }}
                  />
                ) : (
                  <span
                    style={{ fontFamily: f.mono, fontSize: 12, color: c.faint }}
                  >
                    n/a
                  </span>
                )}
              </div>
              <Check
                checked={col.is_title}
                onChange={() => setExclusive(i, "is_title")}
                label={`${col.label} is the card title`}
              />
              <Check
                checked={col.is_status}
                onChange={() => setExclusive(i, "is_status")}
                label={`${col.label} is the status`}
              />
              <div style={{ padding: "6px 12px" }}>
                <button
                  onClick={() =>
                    setColumns((prev) => prev.filter((_, j) => j !== i))
                  }
                  title="Drop this column"
                  style={{
                    background: "none",
                    border: "none",
                    color: c.muted,
                    cursor: "pointer",
                    fontFamily: f.mono,
                    fontSize: 14,
                    padding: 4,
                  }}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={() =>
          setColumns((prev) => [...prev, blankColumn(prev.length, prev.length === 0)])
        }
        style={{
          background: c.paper,
          border: `1px dashed ${c.line}`,
          borderRadius: 4,
          fontFamily: f.mono,
          fontSize: 12,
          color: c.muted,
          padding: "9px 14px",
          cursor: "pointer",
          marginBottom: 22,
        }}
      >
        + add a column
      </button>

      {/* ── sample rows ── */}
      {sample.length > 0 && (
        <details style={{ marginBottom: 22 }}>
          <summary
            style={{
              fontFamily: f.mono,
              fontSize: 12,
              color: c.muted,
              cursor: "pointer",
            }}
          >
            first {sample.length} rows from the sheet
          </summary>
          <div
            style={{
              marginTop: 10,
              background: c.paper,
              border: `1px solid ${c.line}`,
              borderRadius: 4,
              overflowX: "auto",
              padding: 12,
              fontFamily: f.mono,
              fontSize: 12,
              color: c.body,
              whiteSpace: "pre",
            }}
          >
            {sample
              .map((row) =>
                columns.map((col) => (row[col.key] ?? "").slice(0, 22)).join("  |  "),
              )
              .join("\n")}
          </div>
        </details>
      )}

      {/* ── generate ── */}
      <div
        style={{
          display: "flex",
          gap: 16,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={generate}
          disabled={busy || loading}
          className="cl-btn-orange"
          style={{
            background: c.orange,
            color: c.paper,
            border: "none",
            fontFamily: f.display,
            fontWeight: 700,
            fontSize: 16,
            padding: "13px 22px",
            borderRadius: 4,
            cursor: busy ? "wait" : "pointer",
            opacity: busy || loading ? 0.6 : 1,
          }}
        >
          {busy ? "Building…" : "Generate app"}
        </button>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontFamily: f.mono,
            fontSize: 12,
            color: c.muted,
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={notify}
            onChange={() => setNotify((v) => !v)}
            style={{ width: 18, height: 18 }}
          />
          email the &ldquo;your app is ready&rdquo; link to {submission.email}
        </label>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            marginTop: 14,
            fontSize: 14,
            color: c.red,
            background: "#FDECEA",
            border: `1px solid ${c.red}`,
            borderRadius: 4,
            padding: "10px 12px",
            maxWidth: 620,
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}

function blankColumn(i: number, isTitle: boolean): ColumnSpec {
  return {
    key: `col_${i + 1}`,
    label: "",
    type: "text",
    required: isTitle,
    on_card: !isTitle,
    options: [],
    is_title: isTitle,
    is_status: false,
  };
}

function capabilityFieldLabel(type: FieldType): string {
  const labels: Partial<Record<FieldType, string>> = {
    location: "Location",
    photo: "Photo",
    signature: "Signature",
    barcode: "Barcode",
    currency: "Amount",
    rating: "Rating",
  };
  return labels[type] ?? "Field";
}

const opsInput: React.CSSProperties = {
  fontSize: 13,
  padding: "7px 9px",
  border: `1px solid ${c.line}`,
  borderRadius: 3,
  background: "#FFF",
  width: "100%",
  boxSizing: "border-box",
};

function Check({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <div style={{ padding: "6px 12px" }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        aria-label={label}
        style={{ width: 18, height: 18 }}
      />
    </div>
  );
}

function OpsField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label
      style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 180 }}
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
      {children}
      {hint && (
        <span style={{ fontFamily: f.mono, fontSize: 11, color: c.faint }}>
          {hint}
        </span>
      )}
    </label>
  );
}
