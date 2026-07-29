"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_APP_THEME, type AppTheme } from "@/lib/app-theme";
import { c, f } from "@/lib/theme";
import { slugify } from "@/lib/format";
import type { FieldType, IntakeSubmission, PlanTier } from "@/lib/types";
import { AttachmentsPanel, RequestsPanel } from "./BuildPanels";
import {
  generateApp,
  parseSubmission,
  saveBuildDraft,
  sendExistingPreview,
  type BuildDraft,
  type ColumnSpec,
} from "./actions";
import { HumanAppWorkshop } from "./ThemeWorkshop";

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
  const restored = submission.build_draft as BuildDraft;
  const [stage, setStage] = useState<"brief" | "data" | "schema" | "qa">("brief");
  const [loading, setLoading] = useState(!restored.columns?.length);
  const [parseError, setParseError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string>("");
  const [columns, setColumns] = useState<ColumnSpec[]>(restored.columns ?? []);
  const [sample, setSample] = useState<Record<string, string>[]>([]);
  const [company, setCompany] = useState(
    restored.company ?? submission.company_name ?? "",
  );
  const [logLabel, setLogLabel] = useState(restored.logLabel ?? "LOG");
  const [heroLabel, setHeroLabel] = useState(
    restored.heroLabel ?? "ITEMS OPEN RIGHT NOW",
  );
  const [planTier, setPlanTier] = useState<PlanTier>(
    restored.planTier ?? "standard",
  );
  const [theme, setTheme] = useState<AppTheme>(
    restored.theme ?? DEFAULT_APP_THEME,
  );
  const [customHtml, setCustomHtml] = useState(restored.customHtml ?? "");
  const [bespoke, setBespoke] = useState(restored.bespoke ?? false);
  const [selectedSheet, setSelectedSheet] = useState(restored.selectedSheet ?? "");
  const [sourceMode, setSourceMode] = useState<
    "primary" | "append" | "merge"
  >(restored.sourceMode ?? "primary");
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [requestBlockers, setRequestBlockers] = useState(1);
  const [requestTotal, setRequestTotal] = useState(0);
  const [removed, setRemoved] = useState<{ column: ColumnSpec; index: number } | null>(
    null,
  );
  const [qa, setQa] = useState<Record<string, boolean>>(restored.qa ?? {});
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">(
    restored.columns?.length ? "saved" : "idle",
  );
  const [sendState, setSendState] = useState<
    "idle" | "sending" | "sent" | "error"
  >("idle");
  const savedFingerprint = useRef("");
  const [busy, setBusy] = useState(false);
  const [apiKeyCopied, setApiKeyCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    slug: string;
    previewUrl: string;
    imported: number;
    emailed: boolean;
    apiKey: string | null;
  } | null>(null);

  // Seed the company name from the email domain, right about 80% of the time.
  useEffect(() => {
    if (company || submission.company_name) return;
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
  }, [company, submission.company_name, submission.email, submission.name]);

  const readSource = useCallback((sheet?: string) => {
    let cancelled = false;
    setLoading(true);
    setParseError(null);
    parseSubmission(submission.id, sheet)
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
        setSelectedSheet(res.sheetName);
        setSheetNames([res.sheetName, ...res.otherSheets]);
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

  useEffect(() => {
    if (restored.columns?.length) {
      setSummary("saved draft restored");
      return;
    }
    return readSource(restored.selectedSheet);
  }, [readSource, restored.columns, restored.selectedSheet]);

  const schemaIssues = useMemo(() => validateColumns(columns), [columns]);
  const draftFingerprint = useMemo(
    () =>
      JSON.stringify({
        company,
        logLabel,
        heroLabel,
        planTier,
        theme,
        customHtml,
        bespoke,
        selectedSheet,
        sourceMode,
        columns,
        qa,
      }),
    [
      bespoke,
      columns,
      company,
      customHtml,
      heroLabel,
      logLabel,
      planTier,
      qa,
      selectedSheet,
      sourceMode,
      theme,
    ],
  );
  const qaReady =
    requestBlockers === 0 &&
    schemaIssues.length === 0 &&
    Boolean(company.trim()) &&
    sourceMode === "primary" &&
    Boolean(qa.previewTested && qa.commercialConfirmed && qa.emailReviewed);

  const resolutionChanged = useCallback((blockers: number, total: number) => {
    setRequestBlockers(blockers);
    setRequestTotal(total);
  }, []);

  useEffect(() => {
    if (!savedFingerprint.current) {
      savedFingerprint.current = draftFingerprint;
      setSaveState(restored.columns?.length ? "saved" : "idle");
      return;
    }
    if (draftFingerprint !== savedFingerprint.current) setSaveState("idle");
  }, [draftFingerprint, restored.columns]);

  useEffect(() => {
    function warnBeforeLeave(event: BeforeUnloadEvent) {
      if (saveState !== "idle" && saveState !== "error") return;
      event.preventDefault();
    }
    window.addEventListener("beforeunload", warnBeforeLeave);
    return () => window.removeEventListener("beforeunload", warnBeforeLeave);
  }, [saveState]);

  function patch(i: number, next: Partial<ColumnSpec>) {
    setColumns((prev) =>
      prev.map((col, j) => (j === i ? { ...col, ...next } : col)),
    );
  }

  function addCapabilityField(type: FieldType) {
    setColumns((prev) => {
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

  function moveColumn(index: number, direction: -1 | 1) {
    setColumns((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setSaveState("idle");
  }

  function removeColumn(index: number) {
    setColumns((current) => {
      setRemoved({ column: current[index], index });
      return current.filter((_, itemIndex) => itemIndex !== index);
    });
    setSaveState("idle");
  }

  async function saveDraft() {
    setSaveState("saving");
    const result = await saveBuildDraft(submission.id, {
      company,
      logLabel,
      heroLabel,
      planTier,
      theme,
      customHtml,
      bespoke,
      selectedSheet,
      sourceMode,
      columns,
      qa,
    });
    if (result.ok) {
      savedFingerprint.current = draftFingerprint;
      setSaveState("saved");
    }
    else {
      setSaveState("error");
      setError(result.error);
    }
  }

  async function goToStage(
    next: "brief" | "data" | "schema" | "qa",
  ) {
    await saveDraft();
    setStage(next);
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
    if (schemaIssues.length) {
      setError(schemaIssues[0]);
      setStage("schema");
      return;
    }
    if (sourceMode !== "primary") {
      setError(
        "Prepare and select the combined source before building. CrewLog will not silently merge or append unlike files.",
      );
      setStage("data");
      return;
    }
    await saveDraft();
    setBusy(true);
    setError(null);
    try {
      const res = await generateApp({
        submissionId: submission.id,
        companyName: company,
        logLabel,
        heroLabel,
        columns,
        selectedSheet,
        planTier,
        theme,
        customHtml: bespoke && customHtml ? customHtml : null,
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

  async function sendGeneratedPreview() {
    if (!qaReady) {
      setError("Finish the QA checklist and resolve every requirement before sending.");
      return;
    }
    if (
      !window.confirm(
        `Send the QA preview to ${submission.email}? This is the customer delivery step.`,
      )
    ) {
      return;
    }
    setSendState("sending");
    setError(null);
    const response = await sendExistingPreview(submission.id);
    if (!response.ok) {
      setSendState("error");
      setError(response.error);
      return;
    }
    setSendState("sent");
  }

  // ── generated ─────────────────────────────────────────────────────────────

  if (result) {
    const apiEndpoint = `/api/v1/${result.slug}/entries`;
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
          QA build ready. {result.imported} rows in.
        </div>
        <p style={{ fontSize: 16, lineHeight: 1.55, color: c.body, margin: "0 0 16px" }}>
          Nothing has been emailed. Open the QA preview, verify the checklist,
          then explicitly send it to {submission.email}.
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

        <div style={{ marginBottom: 18 }}>
          <QaCheck
            label="I opened the QA preview and tested the core workflow"
            checked={Boolean(qa.previewTested)}
            onChange={() =>
              setQa((current) => ({
                ...current,
                previewTested: !current.previewTested,
              }))
            }
          />
          <QaCheck
            label={`Commercial tier confirmed: ${planTier}`}
            checked={Boolean(qa.commercialConfirmed)}
            onChange={() =>
              setQa((current) => ({
                ...current,
                commercialConfirmed: !current.commercialConfirmed,
              }))
            }
          />
          <QaCheck
            label={`Customer email reviewed: ${submission.email}`}
            checked={Boolean(qa.emailReviewed)}
            onChange={() =>
              setQa((current) => ({
                ...current,
                emailReviewed: !current.emailReviewed,
              }))
            }
          />
        </div>

        <div
          style={{
            border: `2px solid ${c.ink}`,
            padding: 14,
            marginBottom: 18,
          }}
        >
          <div style={{ fontFamily: f.mono, fontSize: 11, fontWeight: 700, marginBottom: 8 }}>
            APP API
          </div>
          <div style={{ fontSize: 13, color: c.muted, marginBottom: 10 }}>
            Endpoint: <code>{apiEndpoint}</code>
          </div>
          {result.apiKey ? (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                Copy this key now. It will not be shown again.
              </div>
              <code
                style={{
                  display: "block",
                  padding: 10,
                  background: c.bg,
                  border: `1px solid ${c.line}`,
                  overflowWrap: "anywhere",
                  marginBottom: 10,
                }}
              >
                {result.apiKey}
              </code>
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(result.apiKey ?? "");
                  setApiKeyCopied(true);
                }}
                style={{
                  background: c.ink,
                  color: c.paper,
                  border: 0,
                  borderRadius: 3,
                  padding: "9px 13px",
                  fontFamily: f.mono,
                  cursor: "pointer",
                }}
              >
                {apiKeyCopied ? "Copied" : "Copy API key"}
              </button>
            </>
          ) : (
            <p style={{ margin: 0, color: c.muted, fontSize: 13 }}>
              This app already existed. Open its project view to create a replacement key.
            </p>
          )}
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
          <button
            type="button"
            onClick={sendGeneratedPreview}
            disabled={!qaReady || sendState === "sending" || sendState === "sent"}
            style={{
              background: c.orange,
              color: c.paper,
              border: 0,
              fontFamily: f.display,
              fontWeight: 700,
              fontSize: 14,
              padding: "12px 18px",
              borderRadius: 4,
              cursor: qaReady ? "pointer" : "not-allowed",
              opacity: !qaReady || sendState === "sending" ? 0.6 : 1,
            }}
          >
            {sendState === "sending"
              ? "Sending…"
              : sendState === "sent"
                ? `Sent to ${submission.email}`
                : `Send preview to ${submission.email}`}
          </button>
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
          Build: {submission.company_name || company || submission.name}
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
        {submission.name} · {submission.email}
        {submission.work_order ? ` · ${submission.work_order}` : ""}
      </div>

      <div style={stageBar}>
        {(
          [
            ["brief", "1 · Brief"],
            ["data", "2 · Data"],
            ["schema", "3 · Schema & experience"],
            ["qa", "4 · QA & delivery"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => void goToStage(id)}
            aria-pressed={stage === id}
            style={{
              ...stageButton,
              background: stage === id ? c.ink : c.paper,
              color: stage === id ? c.paper : c.ink,
            }}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          onClick={saveDraft}
          disabled={saveState === "saving"}
          style={{ ...stageButton, marginLeft: "auto", borderColor: c.orangeDark }}
        >
          {saveState === "saving"
            ? "Saving…"
            : saveState === "saved"
              ? "Draft saved"
              : "Save draft"}
        </button>
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
          display: stage === "brief" ? "grid" : "none",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 16,
          marginBottom: 20,
        }}
      >
        <AttachmentsPanel
          submissionId={submission.id}
          onPrimaryChanged={() => readSource(selectedSheet)}
        />
        <RequestsPanel
          submissionId={submission.id}
          existingTypes={columns.map((column) => column.type)}
          onAddField={addCapabilityField}
          onResolutionChange={resolutionChanged}
        />
      </div>

      {stage === "brief" && (
        <StageFooter
          next="Continue to data"
          onNext={() => void goToStage("data")}
          detail={`${requestTotal - requestBlockers} of ${requestTotal} requirements resolved`}
        />
      )}

      {stage === "data" && (
        <div style={stagePanel}>
          <div style={panelHeading}>DATA SOURCE</div>
          <p style={panelCopy}>
            The file marked PARSING is the active data source. Supporting files
            remain visible in the Brief stage and are not silently imported.
          </p>
          {sheetNames.length > 0 && (
            <label style={{ display: "block", maxWidth: 360 }}>
              <span style={opsLabel}>SHEET TO IMPORT</span>
              <select
                value={selectedSheet}
                onChange={(event) => {
                  setSelectedSheet(event.target.value);
                  readSource(event.target.value);
                  setSaveState("idle");
                }}
                style={opsInput}
              >
                {sheetNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div style={{ marginTop: 16, color: c.body }}>
            {loading ? "Reading the selected source…" : summary || "Manual schema"}
          </div>
          {sample.length > 0 && (
            <pre style={samplePreview}>
              {sample
                .map((row) =>
                  columns.map((column) => row[column.key] ?? "").join(" | "),
                )
                .join("\n")}
            </pre>
          )}
          <div style={sourceDecision}>
            <strong>Multiple files or sheets?</strong>
            <label style={{ display: "flex", gap: 8 }}>
              <input
                type="radio"
                name="source-mode"
                checked={sourceMode === "primary"}
                onChange={() => setSourceMode("primary")}
              />
              Import the selected sheet; treat every other source as context
            </label>
            <label style={{ display: "flex", gap: 8 }}>
              <input
                type="radio"
                name="source-mode"
                checked={sourceMode === "append"}
                onChange={() => setSourceMode("append")}
              />
              Append compatible rows from multiple sources
            </label>
            <label style={{ display: "flex", gap: 8 }}>
              <input
                type="radio"
                name="source-mode"
                checked={sourceMode === "merge"}
                onChange={() => setSourceMode("merge")}
              />
              Merge related sources by a shared identifier
            </label>
            {sourceMode !== "primary" && (
              <span style={{ color: c.red }}>
                Blocked for QA until the operator prepares one reviewed combined
                source. Automatic merging is deliberately disabled.
              </span>
            )}
          </div>
          <StageFooter
            next="Continue to schema"
            onNext={() => void goToStage("schema")}
            detail={selectedSheet ? `Importing sheet: ${selectedSheet}` : "Choose a source"}
          />
        </div>
      )}

      {/* ── company + labels ── */}
      <div
        style={{
          display: stage === "schema" ? "flex" : "none",
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
        <OpsField label="HERO METRIC LABEL" hint="the big number on the dash">
          <input
            value={heroLabel}
            onChange={(e) => setHeroLabel(e.target.value.toUpperCase())}
            style={{ ...opsInput, width: 260, fontFamily: f.mono, fontSize: 12 }}
          />
        </OpsField>
      </div>

      {stage === "schema" && (
        <div style={{ marginBottom: 20 }}>
          <label style={bespokeToggle}>
            <input
              type="checkbox"
              checked={bespoke}
              onChange={() => setBespoke((current) => !current)}
            />
            <span>
              <strong>Use a bespoke app</strong>
              <span style={{ display: "block", color: c.muted, marginTop: 3 }}>
                Reveals project upload, compiled HTML and sandbox controls.
              </span>
            </span>
          </label>
          {bespoke && (
            <HumanAppWorkshop
              company={company}
              value={customHtml}
              onChange={setCustomHtml}
            />
          )}
        </div>
      )}

      {/* ── columns ── */}
      <div
        style={{
          display: stage === "schema" ? "block" : "none",
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
              "FIELD NAME",
              "FIELD TYPE",
              "REQUIRED",
              "SHOW ON LIST CARD",
              "DROPDOWN OPTIONS",
              "CARD TITLE",
              "APP STATUS",
              "ORDER / REMOVE",
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
                  aria-label={`Field name for row ${i + 1}`}
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
                  aria-label={`Field type for ${col.label || `row ${i + 1}`}`}
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
                    aria-label={`Dropdown options for ${col.label || `row ${i + 1}`}`}
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
                  type="button"
                  onClick={() => moveColumn(i, -1)}
                  disabled={i === 0}
                  aria-label={`Move ${col.label || `field ${i + 1}`} up`}
                  style={rowAction}
                >
                  Up
                </button>
                <button
                  type="button"
                  onClick={() => moveColumn(i, 1)}
                  disabled={i === columns.length - 1}
                  aria-label={`Move ${col.label || `field ${i + 1}`} down`}
                  style={rowAction}
                >
                  Down
                </button>
                <button
                  type="button"
                  onClick={() => removeColumn(i)}
                  aria-label={`Remove ${col.label || `field ${i + 1}`}`}
                  style={{ ...rowAction, color: c.red }}
                >
                  Remove
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
          display: stage === "schema" ? "inline-block" : "none",
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
      {false && sample.length > 0 && (
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
      {stage === "schema" && (
        <div className="cl-schema-experience-grid" style={schemaExperienceGrid}>
          <LiveSchemaPreview
            company={company}
            heroLabel={heroLabel}
            columns={columns}
            sample={sample}
          />
          <div style={validationPanel}>
            <div style={panelHeading}>SCHEMA READINESS</div>
            {schemaIssues.length ? (
              schemaIssues.map((issue) => (
                <div key={issue} style={{ color: c.red, marginTop: 7 }}>
                  {issue}
                </div>
              ))
            ) : (
              <div style={{ color: c.green }}>Schema is ready for QA.</div>
            )}
          </div>
        </div>
      )}

      {removed && stage === "schema" && (
        <div role="status" style={undoBar}>
          Removed “{removed.column.label || "untitled field"}”.
          <button
            type="button"
            onClick={() => {
              setColumns((current) => {
                const next = [...current];
                next.splice(removed.index, 0, removed.column);
                return next;
              });
              setRemoved(null);
            }}
            style={quietAction}
          >
            Undo
          </button>
        </div>
      )}

      {stage === "schema" && (
        <StageFooter
          next="Continue to QA"
          onNext={() => void goToStage("qa")}
          detail={
            schemaIssues.length
              ? `${schemaIssues.length} schema issue${schemaIssues.length === 1 ? "" : "s"}`
              : `${columns.length} fields ready`
          }
        />
      )}

      {/* ── generate ── */}
      <div
        style={{
          display: stage === "qa" ? "block" : "none",
          background: c.paper,
          border: `1px solid ${c.line}`,
          borderRadius: 4,
          padding: 20,
        }}
      >
        <div style={panelHeading}>QA & DELIVERY</div>
        <p style={panelCopy}>
          Building creates a private QA preview. It does not email the customer.
        </p>
        <QaCheck
          label="All requirements resolved"
          checked={requestBlockers === 0}
          locked
        />
        <QaCheck
          label="Schema is valid"
          checked={schemaIssues.length === 0}
          locked
        />
        <QaCheck
          label="Data source and import count confirmed"
          checked={Boolean(selectedSheet || parseError)}
          locked
        />
        <QaCheck
          label="Multi-source decision is safe to import"
          checked={sourceMode === "primary"}
          locked
        />
        <QaCheck
          label="QA preview tested"
          checked={Boolean(qa.previewTested)}
          onChange={() =>
            setQa((current) => ({
              ...current,
              previewTested: !current.previewTested,
            }))
          }
        />
        <QaCheck
          label={`Commercial tier confirmed: ${planTier}`}
          checked={Boolean(qa.commercialConfirmed)}
          onChange={() =>
            setQa((current) => ({
              ...current,
              commercialConfirmed: !current.commercialConfirmed,
            }))
          }
        />
        <QaCheck
          label={`Customer email reviewed: ${submission.email}`}
          checked={Boolean(qa.emailReviewed)}
          onChange={() =>
            setQa((current) => ({
              ...current,
              emailReviewed: !current.emailReviewed,
            }))
          }
        />

        <div
          style={{
          display: "flex",
          gap: 16,
          alignItems: "center",
          flexWrap: "wrap",
          marginTop: 20,
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
          {busy ? "Building QA preview…" : "Build QA preview"}
        </button>

          <button type="button" onClick={saveDraft} style={secondaryButton}>
            Save draft
          </button>
          <span style={{ color: c.muted, fontSize: 13 }}>
            Customer delivery happens only after the QA preview opens.
          </span>
        </div>
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

function validateColumns(columns: ColumnSpec[]) {
  const issues: string[] = [];
  const named = columns.filter((column) => column.label.trim());
  if (!named.length) issues.push("Add at least one named field.");
  if (named.filter((column) => column.is_title).length !== 1) {
    issues.push("Choose exactly one field as the card title.");
  }
  if (named.filter((column) => column.is_status).length > 1) {
    issues.push("Choose no more than one app-status field.");
  }
  const keys = named.map((column) => column.key);
  if (new Set(keys).size !== keys.length) {
    issues.push("Every field needs a unique key.");
  }
  if (
    named.some(
      (column) => column.type === "dropdown" && column.options.length === 0,
    )
  ) {
    issues.push("Every dropdown needs at least one option.");
  }
  return issues;
}

function StageFooter({
  next,
  detail,
  onNext,
}: {
  next: string;
  detail: string;
  onNext: () => void;
}) {
  return (
    <div style={stageFooter}>
      <span style={{ color: c.muted, fontSize: 13 }}>{detail}</span>
      <button type="button" onClick={onNext} style={primaryButton}>
        {next}
      </button>
    </div>
  );
}

function QaCheck({
  label,
  checked,
  locked,
  onChange,
}: {
  label: string;
  checked: boolean;
  locked?: boolean;
  onChange?: () => void;
}) {
  return (
    <label style={qaRow}>
      <input
        type="checkbox"
        checked={checked}
        disabled={locked}
        onChange={onChange}
        style={{ width: 20, height: 20 }}
      />
      <span>{label}</span>
      <span
        style={{
          marginLeft: "auto",
          color: checked ? c.green : c.orangeDark,
          fontFamily: f.mono,
          fontSize: 11,
        }}
      >
        {checked ? "READY" : "NEEDS ATTENTION"}
      </span>
    </label>
  );
}

function LiveSchemaPreview({
  company,
  heroLabel,
  columns,
  sample,
}: {
  company: string;
  heroLabel: string;
  columns: ColumnSpec[];
  sample: Record<string, string>[];
}) {
  const title = columns.find((column) => column.is_title) ?? columns[0];
  const status = columns.find((column) => column.is_status);
  const cardFields = columns.filter(
    (column) => column.on_card && !column.is_title && !column.is_status,
  );
  const row = sample[0] ?? {};
  return (
    <div style={phonePreview}>
      <div style={phoneHeader}>
        <strong>{company || "Customer app"}</strong>
        <span>{heroLabel || "ITEMS OPEN"}</span>
      </div>
      <div style={phoneMetric}>{sample.length || "—"}</div>
      <div style={previewCard}>
        <strong>{(title && row[title.key]) || title?.label || "Card title"}</strong>
        {status && (
          <span style={statusPill}>
            {row[status.key] || status.options[0] || "STATUS"}
          </span>
        )}
        <div style={{ marginTop: 9, color: c.muted, fontSize: 11 }}>
          {cardFields.length
            ? cardFields
                .map((field) => row[field.key] || field.label)
                .join(" · ")
            : "Choose fields to show on the list card"}
        </div>
      </div>
      <div style={{ marginTop: 14, fontFamily: f.mono, fontSize: 10, color: c.muted }}>
        FORM ORDER
      </div>
      {columns.slice(0, 5).map((column) => (
        <div key={column.key} style={previewField}>
          {column.label || "Untitled field"}
          {column.required ? " *" : ""}
        </div>
      ))}
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

const stageBar: React.CSSProperties = {
  display: "flex",
  gap: 7,
  flexWrap: "wrap",
  marginBottom: 20,
  paddingBottom: 14,
  borderBottom: `1px solid ${c.line}`,
};
const stageButton: React.CSSProperties = {
  minHeight: 42,
  padding: "9px 12px",
  border: `1px solid ${c.line}`,
  borderRadius: 3,
  background: c.paper,
  fontFamily: f.mono,
  fontSize: 11,
  cursor: "pointer",
};
const stagePanel: React.CSSProperties = {
  background: c.paper,
  border: `1px solid ${c.line}`,
  borderRadius: 4,
  padding: 20,
};
const panelHeading: React.CSSProperties = {
  fontFamily: f.display,
  fontSize: 18,
  fontWeight: 900,
  marginBottom: 8,
};
const panelCopy: React.CSSProperties = {
  color: c.body,
  fontSize: 14,
  lineHeight: 1.5,
  margin: "0 0 16px",
};
const opsLabel: React.CSSProperties = {
  display: "block",
  fontFamily: f.mono,
  fontSize: 11,
  color: c.muted,
  marginBottom: 6,
};
const samplePreview: React.CSSProperties = {
  maxHeight: 180,
  overflow: "auto",
  margin: "14px 0",
  padding: 12,
  border: `1px solid ${c.line}`,
  background: c.bg,
  fontFamily: f.mono,
  fontSize: 11,
  whiteSpace: "pre",
};
const sourceDecision: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 5,
  padding: 14,
  background: c.orangeBg,
  border: `1px solid ${c.orangeDark}`,
  lineHeight: 1.45,
  fontSize: 13,
};
const stageFooter: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 14,
  flexWrap: "wrap",
  marginTop: 20,
};
const primaryButton: React.CSSProperties = {
  minHeight: 44,
  padding: "11px 16px",
  border: 0,
  borderRadius: 3,
  background: c.ink,
  color: c.paper,
  fontFamily: f.display,
  fontWeight: 700,
  cursor: "pointer",
};
const secondaryButton: React.CSSProperties = {
  ...primaryButton,
  border: `1px solid ${c.line}`,
  background: c.paper,
  color: c.ink,
};
const bespokeToggle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "flex-start",
  padding: 14,
  border: `1px solid ${c.line}`,
  background: c.paper,
  cursor: "pointer",
};
const schemaExperienceGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(280px, 360px) minmax(240px, 1fr)",
  gap: 18,
  marginBottom: 18,
};
const phonePreview: React.CSSProperties = {
  border: `8px solid ${c.ink}`,
  borderRadius: 28,
  background: c.bg,
  minHeight: 430,
  padding: 16,
};
const phoneHeader: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 5,
  borderBottom: `2px solid ${c.ink}`,
  paddingBottom: 10,
  fontFamily: f.mono,
  fontSize: 11,
};
const phoneMetric: React.CSSProperties = {
  fontFamily: f.display,
  fontSize: 42,
  fontWeight: 900,
  margin: "16px 0",
};
const previewCard: React.CSSProperties = {
  position: "relative",
  padding: 13,
  background: c.paper,
  border: `1px solid ${c.line}`,
  borderRadius: 4,
};
const statusPill: React.CSSProperties = {
  position: "absolute",
  right: 9,
  top: 9,
  fontFamily: f.mono,
  fontSize: 9,
  color: c.orangeDark,
};
const previewField: React.CSSProperties = {
  marginTop: 7,
  padding: "8px 9px",
  border: `1px solid ${c.line}`,
  background: c.paper,
  fontSize: 11,
};
const validationPanel: React.CSSProperties = {
  alignSelf: "start",
  padding: 16,
  border: `1px solid ${c.line}`,
  background: c.paper,
  fontSize: 13,
};
const undoBar: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  marginBottom: 16,
  padding: 12,
  border: `1px solid ${c.line}`,
  background: c.paper,
  fontSize: 13,
};
const quietAction: React.CSSProperties = {
  border: 0,
  background: "transparent",
  color: c.orangeDark,
  textDecoration: "underline",
  cursor: "pointer",
};
const rowAction: React.CSSProperties = {
  display: "block",
  width: "100%",
  border: 0,
  background: "transparent",
  color: c.muted,
  fontFamily: f.mono,
  fontSize: 10,
  textAlign: "left",
  cursor: "pointer",
};
const qaRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  minHeight: 46,
  borderBottom: `1px solid ${c.lineFaint}`,
  fontSize: 14,
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
