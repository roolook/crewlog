"use client";

import { useEffect, useState, useTransition } from "react";
import { Check } from "@/components/Icon";
import { c, f } from "@/lib/theme";
import { capabilityById } from "@/lib/capabilities";
import type {
  FieldType,
  IntakeRequest,
  RequestStatus,
} from "@/lib/types";
import {
  attachmentLinks,
  setPrimaryAttachment,
  setRequestStatus,
  submissionRequests,
} from "./actions";

type Attachment = Awaited<ReturnType<typeof attachmentLinks>>[number];

/**
 * Everything the customer sent, beside the schema.
 *
 * The operator has to see all of it to build the right thing: which file is the
 * data, which are context, and what the customer actually asked the app to do.
 */
export function AttachmentsPanel({
  submissionId,
  onPrimaryChanged,
}: {
  submissionId: string;
  onPrimaryChanged?: () => void;
}) {
  const [rows, setRows] = useState<Attachment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    attachmentLinks(submissionId)
      .then((r) => {
        if (!cancelled) setRows(r);
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setError(
          reason instanceof Error ? reason.message : "Files could not be loaded.",
        );
        setRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, [submissionId]);

  if (error) return <Panel title="FILES"><PanelError>{error}</PanelError></Panel>;
  if (rows === null) {
    return <Panel title="FILES">loading…</Panel>;
  }
  if (rows.length === 0) {
    return (
      <Panel title="FILES">
        <span style={{ color: c.muted }}>
          Nothing attached. It may be coming by email or from an older intake.
        </span>
      </Panel>
    );
  }

  return (
    <Panel title={`FILES (${rows.length})`}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {rows.map((a) => (
          <div
            key={a.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 10px",
              background: a.isPrimary ? "#FFFDF7" : c.paper,
              border: `1px solid ${a.isPrimary ? c.orangeDark : c.lineFaint}`,
              borderRadius: 3,
            }}
          >
            {a.isPrimary && (
              <span
                style={{
                  fontFamily: f.mono,
                  fontSize: 10,
                  letterSpacing: "0.08em",
                  color: c.orangeDark,
                  border: `1px solid ${c.orangeDark}`,
                  borderRadius: 2,
                  padding: "2px 5px",
                  flexShrink: 0,
                }}
              >
                PARSING
              </span>
            )}
            <span
              style={{
                fontFamily: f.mono,
                fontSize: 12,
                flex: 1,
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={a.fileName}
            >
              {a.fileName}
            </span>
            <span
              style={{
                fontFamily: f.mono,
                fontSize: 11,
                color: c.faint,
                flexShrink: 0,
              }}
            >
              {a.size ? `${Math.max(1, Math.round(a.size / 1024))} KB` : ""}
            </span>
            {!a.isPrimary && (
              <button
                onClick={() =>
                  startTransition(async () => {
                    setError(null);
                    const result = await setPrimaryAttachment(submissionId, a.id);
                    if (!result.ok) {
                      setError("Could not change the parsing file.");
                      return;
                    }
                    setRows((current) =>
                      current?.map((item) => ({
                        ...item,
                        isPrimary: item.id === a.id,
                      })) ?? null,
                    );
                    onPrimaryChanged?.();
                  })
                }
                disabled={pending}
                style={miniBtn}
                title="Parse this file instead"
              >
                parse this
              </button>
            )}
            {a.url && (
              <a
                href={a.url}
                target="_blank"
                rel="noreferrer"
                style={{ ...miniBtn, textDecoration: "underline" }}
              >
                open
              </a>
            )}
          </div>
        ))}
      </div>
    </Panel>
  );
}

const STATUS_LABELS: Record<RequestStatus, string> = {
  open: "unclassified",
  done: "included",
  wont_do: "excluded",
  needs_quote: "needs a quote",
  custom_build: "custom build",
  needs_clarification: "needs clarification",
};

const STATUS_COLOR: Record<RequestStatus, string> = {
  open: c.muted,
  done: c.green,
  wont_do: c.red,
  needs_quote: c.orangeDark,
  custom_build: c.ink,
  needs_clarification: c.orangeDark,
};

/** Every capability the customer asked for, ticked off by hand. */
export function RequestsPanel({
  submissionId,
  existingTypes,
  onAddField,
  onResolutionChange,
}: {
  submissionId: string;
  existingTypes: FieldType[];
  onAddField: (type: FieldType) => void;
  onResolutionChange?: (blockers: number, total: number) => void;
}) {
  const [rows, setRows] = useState<IntakeRequest[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    submissionRequests(submissionId)
      .then((r) => {
        if (!cancelled) setRows(r);
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setLoadError(
          reason instanceof Error
            ? reason.message
            : "Requests could not be loaded.",
        );
        setRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, [submissionId]);

  useEffect(() => {
    if (!rows) return;
    onResolutionChange?.(
      rows.filter(
        (row) =>
          row.status === "open" || row.status === "needs_clarification",
      ).length,
      rows.length,
    );
  }, [rows, onResolutionChange]);

  if (loadError) {
    return (
      <Panel title="WHAT THEY ASKED FOR">
        <PanelError>{loadError}</PanelError>
      </Panel>
    );
  }
  if (rows === null) return <Panel title="WHAT THEY ASKED FOR">loading…</Panel>;
  if (rows.length === 0) {
    return (
      <Panel title="WHAT THEY ASKED FOR">
        <span style={{ color: c.muted }}>
          Nothing specific. Use the sheet as the source.
        </span>
      </Panel>
    );
  }

  const openCount = rows.filter((r) => r.status === "open").length;

  return (
    <Panel
      title={`WHAT THEY ASKED FOR (${openCount} open of ${rows.length})`}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map((r) => {
          const cap = r.capability ? capabilityById(r.capability) : undefined;
          return (
            <div
              key={r.id}
              style={{
                border: `1px solid ${r.status === "open" ? c.lineFaint : STATUS_COLOR[r.status]}`,
                borderRadius: 3,
                padding: "10px 12px",
                background: c.paper,
                opacity: r.status === "open" ? 1 : 0.75,
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>
                    {r.status !== "open" && (
                      <span
                        style={{
                          display: "inline-flex",
                          marginRight: 6,
                          verticalAlign: "middle",
                        }}
                      >
                        <Check size={12} color={STATUS_COLOR[r.status]} weight={3} />
                      </span>
                    )}
                    {r.prompt_label && (
                      <span style={{ display: "block", color: c.muted, fontSize: 12 }}>
                        {r.prompt_label}
                      </span>
                    )}
                    {r.body}
                  </div>
                  {cap && (
                    <div
                      style={{
                        fontFamily: f.mono,
                        fontSize: 11,
                        color: c.muted,
                        marginTop: 3,
                      }}
                    >
                      pick-list · {cap.field ? `set a ${cap.field} column` : "needs a person"}
                    </div>
                  )}
                  {!r.capability && (
                    <div
                      style={{
                        fontFamily: f.mono,
                        fontSize: 11,
                        color: c.muted,
                        marginTop: 3,
                      }}
                    >
                      their own words
                    </div>
                  )}
                </div>
                <span
                  style={{
                    fontFamily: f.mono,
                    fontSize: 10,
                    letterSpacing: "0.08em",
                    color: STATUS_COLOR[r.status],
                    flexShrink: 0,
                  }}
                >
                  {STATUS_LABELS[r.status].toUpperCase()}
                </span>
                </div>
                {cap?.field && (
                  <button
                    type="button"
                    onClick={() => onAddField(cap.field!)}
                    style={{
                      ...miniBtn,
                      marginTop: 8,
                      color: c.orangeDark,
                      textDecoration: "underline",
                    }}
                  >
                    {existingTypes.includes(cap.field)
                      ? `add another ${cap.field} field`
                      : `add ${cap.field} field`}
                  </button>
                )}

              <label
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 5,
                    marginTop: 9,
                    fontFamily: f.mono,
                    fontSize: 11,
                    color: c.muted,
                  }}
                >
                  OPERATOR NOTE · REQUIRED FOR EXCLUDED, QUOTE OR CLARIFICATION
                  <textarea
                    value={r.operator_note ?? ""}
                    onChange={(event) => {
                      setRows(
                        (current) =>
                          current?.map((item) =>
                            item.id === r.id
                              ? { ...item, operator_note: event.target.value }
                              : item,
                          ) ?? null,
                      );
                      setRowErrors((current) => {
                        const next = { ...current };
                        delete next[r.id];
                        return next;
                      });
                    }}
                    rows={2}
                    aria-label={`Operator note for ${r.body}`}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      border: `1px solid ${c.line}`,
                      borderRadius: 3,
                      padding: 8,
                      background: "#FFF",
                    }}
                  />
                  {r.status !== "open" && (
                    <button
                      type="button"
                      onClick={() =>
                        startTransition(async () => {
                          const result = await setRequestStatus(
                            r.id,
                            r.status,
                            r.operator_note ?? undefined,
                          );
                          if (!result.ok) {
                            setRowErrors((current) => ({
                              ...current,
                              [r.id]: result.error ?? "Could not save the note.",
                            }));
                          } else {
                            setRowErrors((current) => {
                              const next = { ...current };
                              delete next[r.id];
                              return next;
                            });
                          }
                        })
                      }
                      style={{ ...miniBtn, alignSelf: "flex-start" }}
                    >
                      save note
                    </button>
                  )}
              </label>

              <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                {([
                  "done",
                  "wont_do",
                  "needs_quote",
                  "custom_build",
                  "needs_clarification",
                ] as RequestStatus[]).map(
                  (s) => (
                    <button
                      key={s}
                      onClick={() =>
                        startTransition(async () => {
                          if (
                            [
                              "wont_do",
                              "needs_quote",
                              "needs_clarification",
                            ].includes(s) &&
                            !r.operator_note?.trim()
                          ) {
                            setRowErrors((current) => ({
                              ...current,
                              [r.id]:
                                "Add a short operator note before choosing this decision.",
                            }));
                            return;
                          }
                          const previous = r.status;
                          setRows(
                            (prev) =>
                              prev?.map((x) =>
                                x.id === r.id ? { ...x, status: s } : x,
                              ) ?? null,
                          );
                          const result = await setRequestStatus(
                            r.id,
                            s,
                            r.operator_note ?? undefined,
                          );
                          if (!result.ok) {
                            setRows(
                              (prev) =>
                                prev?.map((x) =>
                                  x.id === r.id
                                    ? { ...x, status: previous }
                                    : x,
                                ) ?? null,
                            );
                            setRowErrors((current) => ({
                              ...current,
                              [r.id]:
                                result.error ?? "Could not save the request status.",
                            }));
                          } else {
                            setRowErrors((current) => {
                              const next = { ...current };
                              delete next[r.id];
                              return next;
                            });
                          }
                        })
                      }
                      style={{
                        fontFamily: f.mono,
                        fontSize: 10.5,
                        padding: "5px 8px",
                        borderRadius: 2,
                        cursor: "pointer",
                        border: `1px solid ${r.status === s ? STATUS_COLOR[s] : c.line}`,
                        background: r.status === s ? STATUS_COLOR[s] : c.paper,
                        color: r.status === s ? c.paper : c.muted,
                      }}
                    >
                      {STATUS_LABELS[s]}
                    </button>
                  ),
                )}
              </div>
              {rowErrors[r.id] && (
                <div
                  role="alert"
                  style={{ color: c.red, fontSize: 12, marginTop: 7 }}
                >
                  {rowErrors[r.id]}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div
        style={{ fontSize: 12, color: c.muted, marginTop: 10, fontStyle: "italic" }}
      >
        Nothing is emailed automatically. Reply to them yourself.
      </div>
    </Panel>
  );
}

function PanelError({ children }: { children: React.ReactNode }) {
  return <span style={{ color: c.red }}>{children}</span>;
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: c.bg,
        border: `1px solid ${c.line}`,
        borderRadius: 4,
        padding: "14px 16px",
        fontSize: 13,
      }}
    >
      <div
        style={{
          fontFamily: f.mono,
          fontSize: 11,
          letterSpacing: "0.1em",
          color: c.muted,
          marginBottom: 10,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

const miniBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  padding: 0,
  fontFamily: f.mono,
  fontSize: 11,
  color: c.muted,
  cursor: "pointer",
  flexShrink: 0,
};
