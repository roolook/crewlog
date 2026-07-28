"use client";

import { useMemo, useState } from "react";
import { Arrow, Check } from "@/components/Icon";
import { c, f, shadow } from "@/lib/theme";
import { entryNo, timeOfDay, todayStamp } from "@/lib/format";
import { asLocation, displayValue, mapsUrl } from "@/lib/fields";
import { statusField, titleField } from "@/lib/schema";
import type { CustomAppProps } from "../registry";
import type { Entry } from "@/lib/types";

/**
 * A worked example of a custom app: a driver's day.
 *
 * The generated shell is a log — a reverse-chronological list of what happened.
 * This inverts that: it's a work list, ordered by stop, built to be used one
 * thumb at a time in a vehicle. Big rows, one action each, and the count that
 * matters is how many stops are left rather than how many entries exist.
 *
 * Everything it does goes through the same server actions and the same
 * `entries` table as every other tenant, so it inherits RLS isolation, CSV
 * export, invites and auth without implementing any of them.
 */
export function RouteDayApp({ bundle, api }: CustomAppProps) {
  const { tenant, fields } = bundle;
  const [entries, setEntries] = useState<Entry[]>(bundle.entries);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const tField = titleField(fields);
  const sField = statusField(fields);
  const locField = fields.find((x) => x.type === "location");

  // The status option that means "handled" — last option, by convention of how
  // these sheets are written (open first, done last).
  const doneValue = sField?.options[sField.options.length - 1];
  const openValues = useMemo(
    () => (sField?.options ?? []).filter((o) => o !== doneValue),
    [sField, doneValue],
  );

  const remaining = entries.filter(
    (e) => e.status_value !== doneValue,
  );
  const finished = entries.filter((e) => e.status_value === doneValue);

  async function markDone(entry: Entry) {
    if (!sField || !doneValue || !api.updateEntry) return;
    setBusyId(entry.id);
    setError(null);

    // Optimistic, same as the generic shell: the crew is in a van, not waiting.
    setEntries((prev) =>
      prev.map((e) =>
        e.id === entry.id ? { ...e, status_value: doneValue } : e,
      ),
    );

    try {
      const values = { ...entry.data, [sField.key]: doneValue };
      const row = await api.updateEntry(entry.id, values);
      setEntries((prev) => prev.map((e) => (e.id === row.id ? row : e)));
    } catch (e) {
      setEntries(bundle.entries);
      setError(e instanceof Error ? e.message : "Couldn't save that.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div
      style={{
        maxWidth: 480,
        margin: "0 auto",
        height: "100%",
        overflow: "hidden",
        background: c.bg,
        display: "flex",
        flexDirection: "column",
        boxShadow: `0 0 0 1px ${c.lineSoft}`,
      }}
    >
      <header
        style={{
          flexShrink: 0,
          background: c.ink,
          color: c.paper,
          padding: "14px 16px 12px",
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
              fontFamily: f.display,
              fontWeight: 900,
              fontSize: 17,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {tenant.name}
          </div>
          <div style={{ fontFamily: f.mono, fontSize: 11, color: c.faint }}>
            {todayStamp()}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 10,
            marginTop: 10,
          }}
        >
          <div
            style={{
              fontFamily: f.display,
              fontWeight: 900,
              fontSize: 62,
              lineHeight: 1,
            }}
          >
            {remaining.length}
          </div>
          <div
            style={{
              fontFamily: f.mono,
              fontSize: 11,
              letterSpacing: "0.1em",
              color: c.faint,
            }}
          >
            {remaining.length === 1 ? "STOP LEFT" : "STOPS LEFT"}
            {finished.length > 0 && ` · ${finished.length} DONE`}
          </div>
        </div>
      </header>

      <main
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: "14px 14px 40px",
        }}
      >
        {error && (
          <div
            role="alert"
            style={{
              background: "#FDECEA",
              border: `1px solid ${c.red}`,
              borderRadius: 3,
              padding: "10px 12px",
              fontSize: 14,
              color: c.red,
              marginBottom: 12,
            }}
          >
            {error}
          </div>
        )}

        {remaining.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: "70px 20px",
              color: c.muted,
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 600, color: c.body }}>
              Route&apos;s clear.
            </div>
            <div style={{ fontSize: 16, marginTop: 6 }}>
              {finished.length} done today. Go home.
            </div>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {remaining.map((entry, i) => {
            const loc = locField
              ? asLocation(entry.data?.[locField.key] ?? null)
              : null;
            return (
              <div
                key={entry.id}
                style={{
                  background: c.paper,
                  border: `1px solid ${c.line}`,
                  borderRadius: 2,
                  boxShadow: shadow.card,
                  padding: "14px 14px 12px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "baseline",
                    justifyContent: "space-between",
                  }}
                >
                  <div
                    style={{
                      fontFamily: f.mono,
                      fontSize: 11,
                      color: c.orangeDark,
                    }}
                  >
                    STOP {i + 1}
                  </div>
                  <div style={{ fontFamily: f.mono, fontSize: 11, color: c.faint }}>
                    {entryNo(entry.entry_no)}
                  </div>
                </div>

                <div
                  style={{ fontSize: 18, fontWeight: 700, margin: "4px 0 2px" }}
                >
                  {entry.title || "(untitled)"}
                </div>

                {fields
                  .filter(
                    (x) =>
                      x.on_card &&
                      x.key !== tField?.key &&
                      x.key !== sField?.key &&
                      x.type !== "location",
                  )
                  .map((x) => {
                    const shown = displayValue(x.type, entry.data?.[x.key] ?? null);
                    if (!shown) return null;
                    return (
                      <div
                        key={x.key}
                        style={{
                          fontFamily: f.mono,
                          fontSize: 12,
                          color: c.muted,
                        }}
                      >
                        {x.label}: {shown}
                      </div>
                    );
                  })}

                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    marginTop: 12,
                    flexWrap: "wrap",
                  }}
                >
                  {loc && (
                    <a
                      href={mapsUrl(loc)}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        flex: "1 1 auto",
                        minHeight: 56,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        background: c.paper,
                        border: `1px solid ${c.body}`,
                        borderRadius: 2,
                        textDecoration: "none",
                        color: c.ink,
                        fontFamily: f.sans,
                        fontSize: 16,
                        fontWeight: 600,
                      }}
                    >
                      Navigate
                      <Arrow size={13} />
                    </a>
                  )}
                  {sField && doneValue && (
                    <button
                      onClick={() => markDone(entry)}
                      disabled={busyId === entry.id}
                      className="cl-btn-orange"
                      style={{
                        flex: "1 1 auto",
                        minHeight: 56,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        background: c.orange,
                        color: c.paper,
                        border: "none",
                        borderRadius: 2,
                        fontFamily: f.display,
                        fontWeight: 900,
                        fontSize: 15,
                        letterSpacing: "0.04em",
                        cursor: busyId === entry.id ? "wait" : "pointer",
                        boxShadow: shadow.button,
                      }}
                    >
                      <Check size={14} color={c.paper} weight={3} />
                      {busyId === entry.id ? "SAVING…" : doneValue.toUpperCase()}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {finished.length > 0 && (
          <>
            <div
              style={{
                fontFamily: f.mono,
                fontSize: 11,
                letterSpacing: "0.1em",
                color: c.muted,
                margin: "24px 2px 8px",
              }}
            >
              DONE TODAY
            </div>
            <div
              style={{
                background: c.paper,
                border: `1px solid ${c.line}`,
                borderRadius: 2,
                overflow: "hidden",
              }}
            >
              {finished.map((entry) => (
                <div
                  key={entry.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "12px 14px",
                    borderBottom: `1px solid ${c.lineHair}`,
                  }}
                >
                  <Check size={13} color={c.green} weight={3} />
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: 15,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      color: c.muted,
                    }}
                  >
                    {entry.title}
                  </span>
                  <span
                    style={{ fontFamily: f.mono, fontSize: 11, color: c.faint }}
                  >
                    {timeOfDay(entry.updated_at)}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        <div
          style={{
            textAlign: "center",
            fontFamily: f.mono,
            fontSize: 10,
            color: c.faint,
            marginTop: 20,
          }}
        >
          built by CREWLOG · {openValues.length > 0 ? openValues.join(" / ") : "—"}
        </div>
      </main>
    </div>
  );
}
