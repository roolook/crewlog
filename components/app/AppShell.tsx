"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Check } from "@/components/Icon";
import { DEFAULT_APP_THEME } from "@/lib/app-theme";
import { c, f } from "@/lib/theme";
import { dayBucket, entryNo, timeOfDay, todayStamp, toCsv } from "@/lib/format";
import { FieldInput } from "@/components/app/fields/FieldInput";
import { displayValue } from "@/lib/fields";
import {
  cardMeta,
  entryDisplay,
  emptyValues,
  entryValue,
  formFields,
  groupByField,
  missingRequired,
  statusField,
  statusTag,
  titleField,
  valuesFromEntry,
} from "@/lib/schema";
import type { Entry, FieldValue, Member, TenantBundle } from "@/lib/types";

type View = "log" | "form" | "detail" | "search" | "dash" | "team" | "settings";

/**
 * Mutations the shell performs. Every one is optional: /demo passes none and
 * the shell runs entirely on local state, which is how the landing page can
 * embed a fully interactive app with no account and no database round-trips.
 */
export type AppApi = {
  createEntry?: (values: Record<string, FieldValue>) => Promise<Entry>;
  updateEntry?: (
    id: string,
    values: Record<string, FieldValue>,
  ) => Promise<Entry>;
  deleteEntry?: (id: string) => Promise<void>;
  inviteMember?: (contact: string) => Promise<Member>;
  removeMember?: (id: string) => Promise<void>;
};

export function AppShell({
  bundle,
  api = {},
  /** The landing-page embed shouldn't offer log-out or billing links. */
  embedded = false,
}: {
  bundle: TenantBundle;
  api?: AppApi;
  embedded?: boolean;
}) {
  const { tenant, fields, viewerName } = bundle;
  const theme = bundle.theme ?? DEFAULT_APP_THEME;
  const ui = {
    canvas: theme.canvas,
    surface: theme.surface,
    ink: theme.ink,
    muted: theme.muted,
    border: theme.border,
    accent: theme.accent,
    accentText: theme.accentText,
  };

  const [entries, setEntries] = useState<Entry[]>(bundle.entries);
  const [members, setMembers] = useState<Member[]>(bundle.members);
  const [view, setView] = useState<View>("log");
  const [values, setValues] = useState(() => emptyValues(fields));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [query, setQuery] = useState("");
  const [filterValue, setFilterValue] = useState("");
  const [sync, setSync] = useState<"saved" | "syncing" | "error">("saved");
  const [invite, setInvite] = useState("");
  const [inviteNote, setInviteNote] = useState<string | null>(null);
  const [removeConfirm, setRemoveConfirm] = useState<string | null>(null);
  const [exported, setExported] = useState(false);
  const [, startTransition] = useTransition();
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tField = titleField(fields);
  const sField = statusField(fields);
  const formList = useMemo(() => formFields(fields), [fields]);
  const isOwner = bundle.viewerRole === "owner" || bundle.viewerRole === null;
  const isDemo = tenant.id === "demo";

  const settle = (ok = true) => {
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      setSync(ok ? "saved" : "error");
      setFlashId(null);
    }, ok ? 900 : 0);
  };

  // ── mutations ─────────────────────────────────────────────────────────────

  async function save() {
    if (!tField) return;
    if (missingRequired(values, fields).length) return;

    setSync("syncing");
    const title = displayValue(tField.type, values[tField.key] ?? null).trim();
    const statusValue = sField
      ? displayValue(sField.type, values[sField.key] ?? null) || null
      : null;

    if (editingId) {
      // Optimistic: patch in place, then reconcile with whatever came back.
      setEntries((prev) =>
        prev.map((e) =>
          e.id === editingId
            ? { ...e, data: { ...e.data, ...values }, title, status_value: statusValue }
            : e,
        ),
      );
      setFlashId(editingId);
      setView("detail");
      setDetailId(editingId);
      const id = editingId;
      setEditingId(null);

      if (api.updateEntry) {
        try {
          const row = await api.updateEntry(id, values);
          setEntries((prev) => prev.map((e) => (e.id === row.id ? row : e)));
          settle();
        } catch {
          settle(false);
        }
      } else settle();
      return;
    }

    const optimistic: Entry = {
      id: `tmp-${Date.now()}`,
      tenant_id: tenant.id,
      entry_no: Math.max(0, ...entries.map((e) => e.entry_no)) + 1,
      data: { ...values },
      title,
      status_value: statusValue,
      occurred_on: null,
      created_by: null,
      created_by_name: viewerName,
      deleted_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setEntries((prev) => [optimistic, ...prev]);
    setFlashId(optimistic.id);
    setValues(emptyValues(fields));
    setView("log");

    if (api.createEntry) {
      try {
        const row = await api.createEntry(values);
        setEntries((prev) => prev.map((e) => (e.id === optimistic.id ? row : e)));
        setFlashId(row.id);
        settle();
      } catch {
        setEntries((prev) => prev.filter((e) => e.id !== optimistic.id));
        settle(false);
      }
    } else settle();
  }

  async function doDelete() {
    if (!detailId) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    const id = detailId;
    setSync("syncing");
    setEntries((prev) => prev.filter((e) => e.id !== id));
    setView("log");
    setConfirmDelete(false);
    setDetailId(null);
    if (api.deleteEntry) {
      try {
        await api.deleteEntry(id);
        settle();
      } catch {
        settle(false);
      }
    } else settle();
  }

  async function doInvite() {
    const contact = invite.trim();
    if (!contact) return;
    setInvite("");
    if (api.inviteMember) {
      try {
        const m = await api.inviteMember(contact);
        setMembers((prev) => [...prev, m]);
        setInviteNote(
          contact.includes("@")
            ? `Invite emailed to ${contact}.`
            : `Invite created for ${contact} - share the link from the ops console.`,
        );
      } catch (e) {
        setInviteNote(e instanceof Error ? e.message : "Could not send that invite.");
      }
    } else {
      setMembers((prev) => [
        ...prev,
        {
          id: `tmp-${Date.now()}`,
          tenant_id: tenant.id,
          user_id: null,
          display_name: contact,
          email: contact.includes("@") ? contact : null,
          phone: contact.includes("@") ? null : contact,
          role: "crew",
          status: "pending",
          invite_token: null,
          last_log_at: null,
          joined_at: null,
        },
      ]);
      setInviteNote(null);
    }
  }

  async function doRemoveMember(m: Member) {
    if (removeConfirm !== m.id) {
      setRemoveConfirm(m.id);
      return;
    }
    setRemoveConfirm(null);
    setMembers((prev) => prev.filter((x) => x.id !== m.id));
    if (api.removeMember) {
      startTransition(() => {
        api.removeMember?.(m.id).catch(() => setMembers(bundle.members));
      });
    }
  }

  function exportCsv() {
    const cols = formList;
    const rows: (string | number | null)[][] = [
      ["Entry", ...cols.map((x) => x.label), "Logged by", "Logged at"],
      ...entries.map((e) => [
        entryNo(e.entry_no),
        ...cols.map((x) => entryDisplay(e, x)),
        e.created_by_name ?? "",
        new Date(e.created_at).toLocaleString("en-US"),
      ]),
    ];
    const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${tenant.slug}-log.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    setExported(true);
    setTimeout(() => setExported(false), 2500);
  }

  function resetDemo() {
    setEntries(bundle.entries);
    setMembers(bundle.members);
    setView("log");
    setValues(emptyValues(fields));
    setEditingId(null);
    setDetailId(null);
    setQuery("");
    setFilterValue("");
    setInvite("");
    setInviteNote(null);
    setSync("saved");
  }

  // ── derived ───────────────────────────────────────────────────────────────

  const groups = useMemo(() => {
    const order: string[] = [];
    const byDay = new Map<string, Entry[]>();
    for (const e of entries) {
      const d = dayBucket(e.created_at);
      if (!byDay.has(d)) {
        byDay.set(d, []);
        order.push(d);
      }
      byDay.get(d)!.push(e);
    }
    return order.map((d) => ({ label: d, entries: byDay.get(d)! }));
  }, [entries]);

  const filterOptions = sField?.options ?? [];
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (filterValue && e.status_value !== filterValue) return false;
      if (!q) return true;
      const hay = [e.title, ...Object.values(e.data ?? {})]
        .map((v) => String(v ?? ""))
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [entries, query, filterValue]);

  const detail = entries.find((e) => e.id === detailId) ?? null;

  const heroCount = useMemo(() => {
    if (tenant.hero_field_key && tenant.hero_field_value) {
      return entries.filter(
        (e) => entryValue(e, tenant.hero_field_key!) === tenant.hero_field_value,
      ).length;
    }
    return entries.filter((e) => dayBucket(e.created_at) === "TODAY").length;
  }, [entries, tenant.hero_field_key, tenant.hero_field_value]);

  /** Entries per day for the last seven days, oldest first. */
  const bars = useMemo(() => {
    const out: { label: string; n: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toDateString();
      out.push({
        label: d.toLocaleDateString("en-US", { weekday: "narrow" }),
        n: entries.filter((e) => new Date(e.created_at).toDateString() === key)
          .length,
      });
    }
    return out;
  }, [entries]);

  const groupField = useMemo(() => groupByField(fields), [fields]);
  const groupCounts = useMemo(() => {
    if (!groupField) return [];
    return groupField.options.map((opt) => ({
      label: opt,
      n: entries.filter((e) => entryValue(e, groupField.key) === opt).length,
    }));
  }, [entries, groupField]);

  const screenLabel: Record<View, string> = {
    log: tenant.log_label,
    form: editingId ? "EDIT ENTRY" : "NEW ENTRY",
    detail: "ENTRY",
    search: "SEARCH",
    dash: "DASHBOARD",
    team: "TEAM",
    settings: "SETTINGS",
  };

  // ── shared bits ───────────────────────────────────────────────────────────

  const card = (e: Entry) => {
    const tag = statusTag(e.status_value, sField?.options);
    return (
      <button
        key={e.id}
        onClick={() => {
          setDetailId(e.id);
          setConfirmDelete(false);
          setView("detail");
        }}
        style={{
          display: "block",
          width: "100%",
          textAlign: "left",
          cursor: "pointer",
          background: flashId === e.id ? c.greenBg : "transparent",
          border: "none",
          borderBottom: `1px solid ${ui.border}`,
          padding: "13px 14px",
          fontFamily: f.sans,
          color: ui.ink,
          transition: "background 0.6s ease",
          minHeight: 56,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "flex-start",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>
              {e.title || "(untitled)"}
            </div>
            <div
              style={{
                fontFamily: f.mono,
                fontSize: 12,
                color: ui.muted,
                marginTop: 4,
              }}
            >
              {cardMeta(e, fields, entryNo(e.entry_no))}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: 6,
              flexShrink: 0,
            }}
          >
            {sField && (
              <div
                style={{
                  fontFamily: f.mono,
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  padding: "3px 7px",
                  border: `1.5px solid ${tag.color}`,
                  borderRadius: theme.radius,
                  color: tag.filled ? ui.surface : tag.color,
                  background: tag.filled ? tag.color : "transparent",
                  whiteSpace: "nowrap",
                }}
              >
                {tag.label}
              </div>
            )}
            <div style={{ fontFamily: f.mono, fontSize: 11, color: ui.muted }}>
              {timeOfDay(e.created_at)}
            </div>
          </div>
        </div>
      </button>
    );
  };

  const chip = (
    label: string,
    active: boolean,
    onClick: () => void,
    big = true,
  ) => (
    <button
      key={label || "__all"}
      onClick={onClick}
      style={{
        fontFamily: f.sans,
        fontSize: big ? 16 : 14,
        fontWeight: 600,
        cursor: "pointer",
        padding: big ? "14px 18px" : "10px 14px",
        borderRadius: theme.radius,
        minHeight: big ? 56 : 44,
        border: active ? `1.5px solid ${ui.ink}` : `1px solid ${ui.border}`,
        background: active ? ui.ink : "#FFF",
        color: active ? ui.surface : ui.ink,
      }}
    >
      {label}
    </button>
  );

  const sheet: React.CSSProperties = {
    background: ui.surface,
    border: `1px solid ${ui.border}`,
    borderRadius: theme.radius,
    boxShadow: `5px 5px 0 ${ui.border}`,
    overflow: "hidden",
  };

  const fieldLabel = (i: number, label: string) => (
    <span
      style={{
        fontFamily: f.mono,
        fontSize: 11,
        letterSpacing: "0.08em",
        color: ui.muted,
      }}
    >
      <span style={{ color: ui.accent }}>{String(i + 1).padStart(2, "0")} /</span>{" "}
      {label.toUpperCase()}
    </span>
  );

  const textInput: React.CSSProperties = {
    fontSize: 18,
    padding: "16px 14px",
    border: `1px solid ${ui.ink}`,
    borderRadius: theme.radius,
    background: "#FFF",
    fontFamily: f.sans,
    width: "100%",
    boxSizing: "border-box",
  };

  const blockers = missingRequired(values, fields);

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="cl-app-shell"
      style={{
        maxWidth: 480,
        margin: "0 auto",
        height: "100%",
        overflow: "hidden",
        background: ui.canvas,
        display: "flex",
        flexDirection: "column",
        position: "relative",
        boxShadow: `0 0 0 1px ${ui.border}`,
      }}
    >
      <header
        style={{
          flexShrink: 0,
          background: ui.surface,
          borderBottom: `2px solid ${ui.ink}`,
          padding: "12px 16px 9px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 10,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              minWidth: 0,
            }}
          >
            <div
              style={{
                width: 10,
                height: 10,
                background: ui.accent,
                flexShrink: 0,
              }}
            />
            <div
              style={{
                fontFamily: f.display,
                fontWeight: 900,
                fontSize: 18,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {tenant.name}
            </div>
          </div>
          <div
            style={{
              fontFamily: f.mono,
              fontSize: 11,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              gap: 5,
              color:
                sync === "saved" ? c.green : sync === "error" ? c.red : ui.muted,
            }}
          >
            {sync === "saved" && <Check color={c.green} size={11} weight={3} />}
            {isDemo
              ? "local demo"
              : sync === "saved"
                ? "saved"
                : sync === "error"
                  ? "retry"
                  : "syncing…"}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontFamily: f.mono,
            fontSize: 10,
            letterSpacing: "0.1em",
            color: ui.muted,
            marginTop: 5,
          }}
        >
          <span>{screenLabel[view]}</span>
          <span>{todayStamp()}</span>
        </div>
      </header>

      {isDemo && (
        <div
          style={{
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            padding: "7px 12px",
            background: ui.accent,
            color: ui.accentText,
            fontFamily: f.mono,
            fontSize: 10,
            letterSpacing: "0.05em",
          }}
        >
          <span>TRY IT: ADD, EDIT, SEARCH</span>
          <button
            onClick={resetDemo}
            style={{
              border: `1px solid ${ui.accentText}`,
              background: "transparent",
              color: ui.accentText,
              fontFamily: f.mono,
              fontSize: 10,
              padding: "3px 7px",
              borderRadius: theme.radius,
              cursor: "pointer",
            }}
          >
            RESET
          </button>
        </div>
      )}

      <main
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: "16px 14px 40px",
        }}
      >
        {/* ── LOG ───────────────────────────────────────────────────────── */}
        {view === "log" && (
          <div>
            <div style={sheet}>
              {groups.map((g) => (
                <div key={g.label}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontFamily: f.mono,
                      fontSize: 10,
                      letterSpacing: "0.12em",
                      color: ui.muted,
                      background: ui.canvas,
                      borderTop: `1px solid ${ui.border}`,
                      borderBottom: `1px solid ${ui.border}`,
                      padding: "7px 14px",
                    }}
                  >
                    <span>{g.label}</span>
                    <span>
                      {g.entries.length}{" "}
                      {g.entries.length === 1 ? "ENTRY" : "ENTRIES"}
                    </span>
                  </div>
                  {g.entries.map(card)}
                </div>
              ))}
              {entries.length === 0 && (
                <div
                  style={{
                    textAlign: "center",
                    padding: "80px 20px",
                    color: ui.muted,
                  }}
                >
                  <div
                    style={{ fontSize: 18, fontWeight: 600, color: ui.ink }}
                  >
                    No entries yet.
                  </div>
                  <div style={{ fontSize: 16, marginTop: 6 }}>
                    Tap <strong style={{ color: ui.accent }}>+ LOG</strong> to add
                    the first one.
                  </div>
                  <div
                    style={{
                      fontFamily: f.mono,
                      fontSize: 24,
                      marginTop: 18,
                      color: ui.accent,
                    }}
                  >
                    ↘
                  </div>
                </div>
              )}
            </div>
            {entries.length > 0 && (
              <div
                style={{
                  textAlign: "center",
                  fontFamily: f.mono,
                  fontSize: 10,
                  letterSpacing: "0.1em",
                  color: ui.muted,
                  marginTop: 14,
                }}
              >
                - END OF LOG -
              </div>
            )}
          </div>
        )}

        {/* ── FORM ──────────────────────────────────────────────────────── */}
        {view === "form" && (
          <div
            style={{
              ...sheet,
              padding: "20px 16px 24px",
              display: "flex",
              flexDirection: "column",
              gap: 18,
            }}
          >
            <div
              style={{
                fontFamily: f.mono,
                fontSize: 10,
                letterSpacing: "0.12em",
                color: ui.muted,
                borderBottom: `2px solid ${ui.ink}`,
                paddingBottom: 10,
              }}
            >
              {editingId
                ? `EDIT ${entryNo(detail?.entry_no ?? 0)}`
                : `NEW ENTRY ${entryNo(Math.max(0, ...entries.map((e) => e.entry_no)) + 1)}`}
            </div>

            {formList.map((field, i) => (
              <div
                key={field.key}
                style={{ display: "flex", flexDirection: "column", gap: 7 }}
              >
                {fieldLabel(i, field.label)}
                <FieldInput
                  field={field}
                  value={values[field.key] ?? null}
                  onChange={(v) =>
                    setValues((prev) => ({ ...prev, [field.key]: v }))
                  }
                  tenantId={tenant.id}
                  isTitle={field.key === tField?.key}
                  chip={(label, active, onClick) => chip(label, active, onClick)}
                  textInput={textInput}
                />
              </div>
            ))}

            <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
              <button
                onClick={() => {
                  setView(editingId ? "detail" : "log");
                  setEditingId(null);
                  setValues(emptyValues(fields));
                }}
                style={{
                  flex: "0 0 auto",
                  background: ui.surface,
                  color: ui.ink,
                  border: `1px solid ${ui.ink}`,
                  fontSize: 16,
                  padding: "0 20px",
                  borderRadius: theme.radius,
                  cursor: "pointer",
                  minHeight: 64,
                  fontFamily: f.sans,
                }}
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={blockers.length > 0}
                className={blockers.length ? undefined : "cl-btn-orange"}
                style={{
                  flex: 1,
                  background: ui.accent,
                  color: ui.surface,
                  border: "none",
                  fontFamily: f.display,
                  fontWeight: 900,
                  fontSize: 18,
                  letterSpacing: "0.04em",
                  borderRadius: theme.radius,
                  cursor: blockers.length ? "not-allowed" : "pointer",
                  minHeight: 64,
                  boxShadow: `4px 4px 0 ${ui.ink}`,
                  opacity: blockers.length ? 0.45 : 1,
                }}
              >
                LOG IT ↓
              </button>
            </div>
            {blockers.length > 0 && (
              <div style={{ fontSize: 14, color: ui.muted, fontStyle: "italic" }}>
                {blockers.map((b) => b.label).join(", ")} still needed.
              </div>
            )}
          </div>
        )}

        {/* ── DETAIL ────────────────────────────────────────────────────── */}
        {view === "detail" && detail && (
          <div>
            <button
              onClick={() => {
                setView("log");
                setConfirmDelete(false);
              }}
              style={{
                background: "none",
                border: "none",
                fontFamily: f.mono,
                fontSize: 13,
                color: ui.muted,
                cursor: "pointer",
                padding: "4px 0",
                marginBottom: 12,
                textDecoration: "underline",
              }}
            >
              ← BACK TO LOG
            </button>
            <div
              style={{
                ...sheet,
                padding: "18px 18px 16px",
                position: "relative",
              }}
            >
              {sField && detail.status_value && (
                <div
                  style={{
                    position: "absolute",
                    top: 10,
                    right: 12,
                    fontFamily: f.display,
                    fontWeight: 900,
                    fontSize: 16,
                    letterSpacing: "0.06em",
                    color: statusTag(detail.status_value, sField.options).color,
                    border: `2.5px solid ${statusTag(detail.status_value, sField.options).color}`,
                    padding: "4px 10px",
                    borderRadius: theme.radius,
                    transform: "rotate(-3deg)",
                    mixBlendMode: "multiply",
                    opacity: 0.85,
                    pointerEvents: "none",
                  }}
                >
                  {detail.status_value.toUpperCase()}
                </div>
              )}
              <div
                style={{
                  fontFamily: f.mono,
                  fontSize: 10,
                  letterSpacing: "0.12em",
                  color: ui.muted,
                  borderBottom: `2px solid ${ui.ink}`,
                  paddingBottom: 12,
                }}
              >
                ENTRY {entryNo(detail.entry_no)} ·{" "}
                {dayBucket(detail.created_at)}
              </div>
              {formList.map((field) => (
                <div
                  key={field.key}
                  style={{
                    display: "flex",
                    gap: 14,
                    padding: "13px 0",
                    borderBottom: `1px dashed ${ui.border}`,
                    alignItems: "baseline",
                  }}
                >
                  <div
                    style={{
                      fontFamily: f.mono,
                      fontSize: 11,
                      letterSpacing: "0.06em",
                      color: ui.muted,
                      flex: "0 0 96px",
                    }}
                  >
                    {field.label.toUpperCase()}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 600, minWidth: 0 }}>
                    {entryDisplay(detail, field) || "-"}
                  </div>
                </div>
              ))}
              <div
                style={{
                  fontFamily: f.mono,
                  fontSize: 12,
                  color: ui.muted,
                  paddingTop: 14,
                }}
              >
                logged by {detail.created_by_name ?? "-"} ·{" "}
                {timeOfDay(detail.created_at)}
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button
                onClick={() => {
                  setValues(valuesFromEntry(detail, fields));
                  setEditingId(detail.id);
                  setView("form");
                }}
                style={{
                  flex: 1,
                  background: ui.ink,
                  color: ui.surface,
                  border: "none",
                  fontSize: 16,
                  fontWeight: 700,
                  padding: 16,
                  borderRadius: theme.radius,
                  cursor: "pointer",
                  minHeight: 56,
                  fontFamily: f.sans,
                }}
              >
                Edit
              </button>
              <button
                onClick={doDelete}
                style={{
                  flex: 1,
                  background: ui.surface,
                  color: c.red,
                  border: `1px solid ${c.red}`,
                  fontSize: 16,
                  fontWeight: 600,
                  padding: 16,
                  borderRadius: theme.radius,
                  cursor: "pointer",
                  minHeight: 56,
                  fontFamily: f.sans,
                }}
              >
                {confirmDelete ? "Really delete?" : "Delete"}
              </button>
            </div>
            <div
              style={{
                fontSize: 13,
                color: ui.muted,
                marginTop: 10,
                fontStyle: "italic",
              }}
            >
              Deleted entries are recoverable by the owner for 30 days.
            </div>
          </div>
        )}

        {/* ── SEARCH ────────────────────────────────────────────────────── */}
        {view === "search" && (
          <div>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search everything…"
              style={{ ...textInput, fontSize: 18, marginBottom: 12 }}
            />
            {filterOptions.length > 0 && (
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  marginBottom: 16,
                }}
              >
                {chip("All", filterValue === "", () => setFilterValue(""), false)}
                {filterOptions.map((opt) =>
                  chip(opt, filterValue === opt, () => setFilterValue(opt), false),
                )}
              </div>
            )}
            <div style={sheet}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontFamily: f.mono,
                  fontSize: 10,
                  letterSpacing: "0.12em",
                  color: ui.muted,
                  background: ui.canvas,
                  borderBottom: `1px solid ${ui.border}`,
                  padding: "7px 14px",
                }}
              >
                <span>RESULTS</span>
                <span>
                  {results.length} {results.length === 1 ? "ENTRY" : "ENTRIES"}
                </span>
              </div>
              {results.map(card)}
              {results.length === 0 && (
                <div
                  style={{
                    textAlign: "center",
                    padding: "60px 20px",
                    color: ui.muted,
                  }}
                >
                  <div style={{ fontSize: 16, fontWeight: 600, color: ui.ink }}>
                    Nothing matches.
                  </div>
                  <div style={{ fontSize: 14, marginTop: 6 }}>
                    Check spelling, or clear filters.
                  </div>
                  <button
                    onClick={() => {
                      setQuery("");
                      setFilterValue("");
                    }}
                    style={{
                      marginTop: 16,
                      background: ui.surface,
                      border: `1px solid ${ui.ink}`,
                      fontSize: 16,
                      padding: "12px 20px",
                      borderRadius: theme.radius,
                      cursor: "pointer",
                      minHeight: 56,
                      fontFamily: f.sans,
                    }}
                  >
                    Clear filters
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── DASH ──────────────────────────────────────────────────────── */}
        {view === "dash" && (
          <div>
            <div
              style={{
                background: ui.ink,
                color: ui.surface,
                borderRadius: theme.radius,
                padding: "22px 20px 24px",
                boxShadow: `5px 5px 0 ${ui.muted}`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontFamily: f.mono,
                  fontSize: 10,
                  letterSpacing: "0.12em",
                  color: ui.muted,
                  gap: 10,
                }}
              >
                <span>{tenant.hero_label}</span>
                <span style={{ flexShrink: 0 }}>{todayStamp()}</span>
              </div>
              <div
                style={{
                  fontFamily: f.display,
                  fontWeight: 900,
                  fontSize: 78,
                  lineHeight: 1,
                  marginTop: 10,
                }}
              >
                {heroCount}
              </div>
            </div>

            <div
              style={{
                fontFamily: f.mono,
                fontSize: 10,
                letterSpacing: "0.12em",
                color: ui.muted,
                margin: "24px 2px 8px",
              }}
            >
              ENTRIES · LAST 7 DAYS
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: 6,
                height: 96,
                background: ui.surface,
                border: `1px solid ${ui.border}`,
                borderRadius: theme.radius,
                boxShadow: `5px 5px 0 ${ui.border}`,
                padding: "14px 14px 10px",
                boxSizing: "border-box",
              }}
            >
              {bars.map((b, i) => {
                const max = Math.max(1, ...bars.map((x) => x.n));
                return (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 4,
                      height: "100%",
                      justifyContent: "flex-end",
                    }}
                  >
                    <div
                      style={{
                        width: "100%",
                        maxWidth: 26,
                        height: `${(b.n / max) * 100}%`,
                        minHeight: b.n > 0 ? 3 : 0,
                        background: i === bars.length - 1 ? ui.accent : ui.border,
                      }}
                      title={`${b.n} entries`}
                    />
                    <div
                      style={{ fontFamily: f.mono, fontSize: 10, color: ui.muted }}
                    >
                      {b.label}
                    </div>
                  </div>
                );
              })}
            </div>

            {groupField && (
              <>
                <div
                  style={{
                    fontFamily: f.mono,
                    fontSize: 10,
                    letterSpacing: "0.12em",
                    color: ui.muted,
                    margin: "24px 2px 8px",
                  }}
                >
                  BY {groupField.label.toUpperCase()}
                </div>
                <div
                  style={{
                    background: ui.surface,
                    border: `1px solid ${ui.border}`,
                    borderRadius: theme.radius,
                    boxShadow: `5px 5px 0 ${ui.border}`,
                    padding: "4px 16px",
                  }}
                >
                  {groupCounts.map((g) => (
                    <div
                      key={g.label}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                        padding: "13px 0",
                        borderBottom: `1px dashed ${ui.border}`,
                        fontSize: 16,
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>{g.label}</div>
                      <div style={{ fontFamily: f.mono, color: ui.muted }}>
                        {g.n}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── TEAM ──────────────────────────────────────────────────────── */}
        {view === "team" && (
          <div>
            <div style={sheet}>
              {members.map((m) => {
                const badge =
                  m.role === "owner"
                    ? { border: ui.ink, bg: ui.ink, fg: ui.surface, label: "OWNER" }
                    : m.status === "pending"
                      ? {
                          border: ui.muted,
                          bg: "transparent",
                          fg: ui.muted,
                          label: "PENDING",
                        }
                      : {
                          border: ui.accent,
                          bg: "transparent",
                          fg: ui.accent,
                          label: "CREW",
                        };
                return (
                  <div
                    key={m.id}
                    style={{
                      padding: "14px 16px",
                      borderBottom: `1px solid ${ui.border}`,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>
                        {m.display_name}
                      </div>
                      <div
                        style={{
                          fontFamily: f.mono,
                          fontSize: 11,
                          color: ui.muted,
                          marginTop: 3,
                        }}
                      >
                        {m.status === "pending"
                          ? "invite sent"
                          : m.last_log_at
                            ? `last log ${timeOfDay(m.last_log_at)}`
                            : "no entries yet"}
                      </div>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        flexShrink: 0,
                      }}
                    >
                      <div
                        style={{
                          fontFamily: f.mono,
                          fontSize: 10,
                          letterSpacing: "0.08em",
                          padding: "4px 8px",
                          borderRadius: theme.radius,
                          border: `1.5px solid ${badge.border}`,
                          background: badge.bg,
                          color: badge.fg,
                        }}
                      >
                        {badge.label}
                      </div>
                      {isOwner && m.role !== "owner" && (
                        <button
                          onClick={() => doRemoveMember(m)}
                          style={{
                            background: "none",
                            border: "none",
                            fontFamily: f.mono,
                            fontSize: 12,
                            color: ui.muted,
                            cursor: "pointer",
                            textDecoration: "underline",
                            padding: "8px 2px",
                          }}
                        >
                          {removeConfirm === m.id ? "confirm" : "remove"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {isOwner && (
              <div
                style={{
                  background: ui.surface,
                  border: `1.5px dashed ${ui.muted}`,
                  borderRadius: theme.radius,
                  padding: 16,
                  marginTop: 18,
                }}
              >
                <div
                  style={{
                    fontFamily: f.mono,
                    fontSize: 11,
                    letterSpacing: "0.08em",
                    color: ui.muted,
                    marginBottom: 10,
                  }}
                >
                  <span style={{ color: ui.accent }}>+</span> INVITE BY EMAIL OR
                  PHONE
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    value={invite}
                    onChange={(e) => setInvite(e.target.value)}
                    placeholder="name@crew.com or (555) 014-2288"
                    style={{
                      ...textInput,
                      flex: 1,
                      minWidth: 0,
                      fontSize: 16,
                      padding: "14px 12px",
                      fontFamily: f.mono,
                    }}
                  />
                  <button
                    onClick={doInvite}
                    className="cl-btn-orange"
                    style={{
                      background: ui.accent,
                      color: ui.surface,
                      border: "none",
                      fontFamily: f.display,
                      fontWeight: 900,
                      fontSize: 14,
                      letterSpacing: "0.04em",
                      padding: "0 18px",
                      borderRadius: theme.radius,
                      cursor: "pointer",
                      minHeight: 56,
                      flexShrink: 0,
                    }}
                  >
                    SEND LINK
                  </button>
                </div>
                <div style={{ fontSize: 13, color: ui.muted, marginTop: 10 }}>
                  {inviteNote ??
                    "They get a link. Tap it, they're in. No password."}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── SETTINGS ──────────────────────────────────────────────────── */}
        {view === "settings" && (
          <div>
            <div style={sheet}>
              <button
                onClick={exportCsv}
                style={{
                  display: "block",
                  width: "100%",
                  background: "none",
                  border: "none",
                  borderBottom: `1px solid ${ui.border}`,
                  padding: 16,
                  textAlign: "left",
                  cursor: "pointer",
                  minHeight: 64,
                  fontFamily: f.sans,
                }}
              >
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 16,
                    color: ui.ink,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  {exported && <Check color={c.green} size={14} />}
                  {exported ? "Downloaded" : "Download CSV"}
                </div>
                <div style={{ fontSize: 14, color: ui.muted, marginTop: 2 }}>
                  Your data, always.
                </div>
              </button>

              <a
                href={`mailto:${"build@crewlog.app"}?subject=${encodeURIComponent(
                  `Change request - ${tenant.slug}`,
                )}`}
                style={{
                  display: "block",
                  padding: 16,
                  borderBottom: `1px solid ${ui.border}`,
                  textDecoration: "none",
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 16, color: ui.ink }}>
                  Request a change
                </div>
                <div style={{ fontSize: 14, color: ui.muted, marginTop: 2 }}>
                  Need a new column? A person handles it within a day.
                </div>
              </a>

              <div style={{ padding: 16, borderBottom: `1px solid ${ui.border}` }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>Storage</div>
                <div
                  style={{
                    fontFamily: f.mono,
                    fontSize: 12,
                    color: c.green,
                    marginTop: 4,
                  }}
                >
                  {entries.length} entries · {tenant.storage_limit_mb / 1024} GB
                  included
                </div>
              </div>

              {isDemo && (
                <button
                  onClick={resetDemo}
                  style={{
                    display: "block",
                    width: "100%",
                    background: "none",
                    border: "none",
                    borderBottom: `1px solid ${ui.border}`,
                    padding: 16,
                    textAlign: "left",
                    cursor: "pointer",
                    fontFamily: f.sans,
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 16, color: ui.ink }}>
                    Reset sample data
                  </div>
                  <div style={{ fontSize: 14, color: ui.muted, marginTop: 2 }}>
                    Put every demo entry back where it started.
                  </div>
                </button>
              )}

              {!embedded && (
                <div style={{ padding: 16 }}>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>
                    Plan
                  </div>
                  <div
                    style={{
                      fontFamily: f.mono,
                      fontSize: 12,
                      color: ui.muted,
                      marginTop: 4,
                    }}
                  >
                    {tenant.status === "active"
                      ? `active since ${new Date(tenant.activated_at ?? tenant.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`
                      : tenant.status}
                  </div>
                </div>
              )}
            </div>

            {!embedded && (
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  style={{
                    display: "block",
                    margin: "14px auto 0",
                    background: "none",
                    border: "none",
                    fontFamily: f.mono,
                    fontSize: 13,
                    color: ui.muted,
                    cursor: "pointer",
                    textDecoration: "underline",
                    padding: 14,
                  }}
                >
                  log out
                </button>
              </form>
            )}
            <div
              style={{
                textAlign: "center",
                fontFamily: f.mono,
                fontSize: 11,
                color: ui.muted,
                padding: "8px 0",
              }}
            >
              built by CREWLOG · build@crewlog.app
            </div>
          </div>
        )}
      </main>

      {(view === "log" || view === "search") && (
        <button
          onClick={() => {
            setValues(emptyValues(fields));
            setEditingId(null);
            setView("form");
          }}
          className="cl-btn-orange"
          style={{
            position: "absolute",
            bottom: 86,
            right: 16,
            zIndex: 30,
            background: ui.accent,
            color: ui.surface,
            border: "none",
            fontFamily: f.display,
            fontWeight: 900,
            fontSize: 18,
            letterSpacing: "0.04em",
            padding: "0 24px",
            minHeight: 64,
            borderRadius: theme.radius,
            cursor: "pointer",
            boxShadow: `4px 4px 0 ${ui.ink}`,
          }}
        >
          + LOG
        </button>
      )}

      <nav style={{ flexShrink: 0, background: ui.ink, display: "flex" }}>
        {(
          [
            ["LOG", "log"],
            ["SEARCH", "search"],
            ["DASH", "dash"],
            ["TEAM", "team"],
            ["SET", "settings"],
          ] as [string, View][]
        ).map(([label, v]) => (
          <button
            key={v}
            onClick={() => {
              setView(v);
              setConfirmDelete(false);
            }}
            style={{
              flex: 1,
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "14px 4px 24px",
              minHeight: 56,
              fontFamily: f.mono,
              fontSize: 12,
              letterSpacing: "0.08em",
              color: view === v ? ui.surface : ui.muted,
              fontWeight: view === v ? 700 : 500,
              borderTop: `3px solid ${view === v ? ui.accent : "transparent"}`,
            }}
          >
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
