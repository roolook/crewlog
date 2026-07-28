"use client";

import { useMemo, useState } from "react";
import {
  DEFAULT_APP_THEME,
  type AppTheme,
} from "@/lib/app-theme";
import {
  appBuildPrompt,
  parseAppBlueprint,
  type AppBlueprint,
} from "@/lib/app-blueprint";
import { c, f } from "@/lib/theme";

export function ThemeWorkshop({
  company,
  logLabel,
  fields,
  value,
  onChange,
  onBlueprintChange,
}: {
  company: string;
  logLabel: string;
  fields: { key: string; label: string; type: string; required: boolean }[];
  value: AppTheme;
  onChange: (theme: AppTheme) => void;
  onBlueprintChange: (blueprint: AppBlueprint | null) => void;
}) {
  const [inspiration, setInspiration] = useState("");
  const [response, setResponse] = useState("");
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [fileCount, setFileCount] = useState(0);

  const prompt = useMemo(
    () => appBuildPrompt({ company, logLabel, fields, inspiration }),
    [company, fields, inspiration, logLabel],
  );

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setMessage(null);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setMessage("Clipboard access failed. Select and copy the prompt below.");
    }
  }

  function applyResponse() {
    const parsed = parseAppBlueprint(response);
    if (!parsed) {
      setMessage("That is not a complete CrewLog app bundle. Paste the full JSON response.");
      return;
    }
    onChange(parsed.theme);
    onBlueprintChange(parsed);
    setFileCount(parsed.files.length);
    setMessage(`Applied ${parsed.appName}: ${parsed.files.length} complete files`);
  }

  return (
    <section
      style={{
        border: `1px solid ${c.line}`,
        background: c.paper,
        borderRadius: 4,
        marginBottom: 20,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          padding: "14px 16px",
          borderBottom: `2px solid ${c.ink}`,
          alignItems: "baseline",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontFamily: f.display, fontWeight: 900, fontSize: 18 }}>
            AI APP BUILD
          </div>
          <div style={{ fontFamily: f.mono, fontSize: 11, color: c.muted }}>
            product brief in, complete file bundle and app contract back
          </div>
        </div>
        <button
          onClick={() => {
            onChange(DEFAULT_APP_THEME);
            onBlueprintChange(null);
            setFileCount(0);
            setResponse("");
          }}
          style={quietButton}
        >
          reset design
        </button>
      </div>

      <div
        className="cl-theme-workshop-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(260px, 1.25fr) minmax(230px, 0.75fr)",
          gap: 18,
          padding: 16,
        }}
      >
        <div>
          <label style={labelStyle}>
            PRODUCT AND DESIGN INSPIRATION
            <textarea
              value={inspiration}
              onChange={(event) => setInspiration(event.target.value)}
              placeholder="Examples: the service tags on our trucks, our navy uniforms, old municipal work orders. Avoid glossy SaaS styling."
              rows={4}
              style={textArea}
            />
          </label>

          <button onClick={copyPrompt} style={darkButton}>
            {copied ? "Full build prompt copied" : "Copy complete AI app prompt"}
          </button>
          <details style={{ marginTop: 9 }}>
            <summary
              style={{
                fontFamily: f.mono,
                fontSize: 11,
                color: c.muted,
                cursor: "pointer",
              }}
            >
              view prompt
            </summary>
            <pre
              style={{
                whiteSpace: "pre-wrap",
                overflowWrap: "anywhere",
                fontFamily: f.mono,
                fontSize: 11,
                lineHeight: 1.45,
                color: c.body,
                background: c.bg,
                border: `1px solid ${c.line}`,
                padding: 10,
                maxHeight: 260,
                overflowY: "auto",
              }}
            >
              {prompt}
            </pre>
          </details>

          <label style={{ ...labelStyle, marginTop: 16 }}>
            AI RESPONSE
            <textarea
              value={response}
              onChange={(event) => {
                setResponse(event.target.value);
                setMessage(null);
              }}
              placeholder='Paste the returned {"version":1,"files":[...]} app bundle here'
              rows={7}
              spellCheck={false}
              style={{ ...textArea, fontFamily: f.mono, fontSize: 12 }}
            />
          </label>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button onClick={applyResponse} style={orangeButton}>
              Validate and use app bundle
            </button>
            {message && (
              <span
                role="status"
                style={{
                  fontSize: 12,
                  color: message.startsWith("Applied") ? c.green : c.red,
                }}
              >
                {message}
              </span>
            )}
            {fileCount > 0 && (
              <span style={{ fontFamily: f.mono, fontSize: 11, color: c.muted }}>
                saved with this build
              </span>
            )}
          </div>
        </div>

        <ThemePreview theme={value} company={company || "Your company"} logLabel={logLabel} />
      </div>
    </section>
  );
}

function ThemePreview({
  theme,
  company,
  logLabel,
}: {
  theme: AppTheme;
  company: string;
  logLabel: string;
}) {
  return (
    <div>
      <div style={{ fontFamily: f.mono, fontSize: 11, color: c.muted, marginBottom: 7 }}>
        LIVE TOKEN PREVIEW · {theme.name.toUpperCase()}
      </div>
      <div
        style={{
          background: theme.canvas,
          color: theme.ink,
          border: `1px solid ${theme.border}`,
          borderRadius: theme.radius,
          overflow: "hidden",
          minHeight: 330,
        }}
      >
        <div
          style={{
            background: theme.surface,
            borderBottom: `2px solid ${theme.ink}`,
            padding: "12px 13px 9px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ width: 9, height: 9, background: theme.accent }} />
            <strong style={{ fontFamily: f.display, fontSize: 16 }}>{company}</strong>
          </div>
          <div style={{ fontFamily: f.mono, fontSize: 10, color: theme.muted, marginTop: 4 }}>
            {(logLabel || "LOG").toUpperCase()} · TODAY
          </div>
        </div>
        <div style={{ padding: 10 }}>
          {["First sample entry", "Another job in progress"].map((title, index) => (
            <div
              key={title}
              style={{
                background: theme.surface,
                border: `1px solid ${theme.border}`,
                borderRadius: theme.radius,
                padding: "10px 11px",
                marginBottom: 8,
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 14 }}>{title}</div>
              <div style={{ fontFamily: f.mono, fontSize: 10, color: theme.muted, marginTop: 3 }}>
                Nº000{index + 1} · CREW · 9:{index}8 AM
              </div>
            </div>
          ))}
          <button
            type="button"
            style={{
              width: "100%",
              marginTop: 12,
              border: "none",
              background: theme.accent,
              color: theme.accentText,
              borderRadius: theme.radius,
              minHeight: 46,
              fontFamily: f.display,
              fontWeight: 900,
            }}
          >
            + LOG
          </button>
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  fontFamily: f.mono,
  fontSize: 11,
  letterSpacing: "0.08em",
  color: c.muted,
};

const textArea: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  resize: "vertical",
  border: `1px solid ${c.line}`,
  borderRadius: 3,
  background: "#FFF",
  color: c.ink,
  padding: "10px 11px",
  fontFamily: f.sans,
  fontSize: 14,
  lineHeight: 1.45,
};

const darkButton: React.CSSProperties = {
  marginTop: 9,
  background: c.ink,
  color: c.paper,
  border: "none",
  borderRadius: 3,
  padding: "10px 14px",
  fontFamily: f.display,
  fontWeight: 700,
  cursor: "pointer",
};

const orangeButton: React.CSSProperties = {
  ...darkButton,
  marginTop: 9,
  background: c.orange,
};

const quietButton: React.CSSProperties = {
  background: "none",
  color: c.muted,
  border: "none",
  padding: "5px 0",
  fontFamily: f.mono,
  fontSize: 11,
  textDecoration: "underline",
  cursor: "pointer",
};
