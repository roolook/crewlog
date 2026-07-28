"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  customHtmlDocument,
  starterCustomHtml,
  validateCustomHtml,
} from "@/lib/custom-html";
import { c, f } from "@/lib/theme";

export function HumanAppWorkshop({
  company,
  value,
  onChange,
}: {
  company: string;
  value: string;
  onChange: (html: string) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const previewFrame = useRef<HTMLIFrameElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [valid, setValid] = useState(Boolean(value));

  useEffect(() => {
    function mockBridge(event: MessageEvent) {
      if (event.source !== previewFrame.current?.contentWindow) return;
      const request = event.data as {
        source?: string;
        id?: string;
        method?: string;
      };
      if (request.source !== "crewlog-app" || !request.id || !request.method) return;
      const context = {
        tenant: {
          id: "preview",
          slug: "preview",
          name: company || "Customer",
          logLabel: "WORK LOG",
          status: "preview",
        },
        fields: [],
        viewer: { role: "owner", name: "Preview user" },
      };
      const entries = [
        {
          id: "preview-1",
          tenant_id: "preview",
          entry_no: 1,
          title: "First sample entry",
          status_value: "Open",
          data: {},
          created_by_name: "Preview user",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];
      const result =
        request.method === "getContext"
          ? context
          : request.method === "listEntries"
            ? entries
            : request.method === "listMembers"
              ? []
              : undefined;
      previewFrame.current?.contentWindow?.postMessage(
        result === undefined
          ? {
              source: "crewlog-host",
              id: request.id,
              ok: false,
              error: "Writes are disabled in the dashboard preview.",
            }
          : { source: "crewlog-host", id: request.id, ok: true, result },
        "*",
      );
    }
    window.addEventListener("message", mockBridge);
    return () => window.removeEventListener("message", mockBridge);
  }, [company]);

  function validate(source = value) {
    const result = validateCustomHtml(source);
    setValid(result.ok);
    setMessage(result.ok ? "Valid custom app. Save the build to publish it." : result.error);
  }

  async function loadFile(file: File | null) {
    if (!file) return;
    if (!/\.html?$/i.test(file.name)) {
      setValid(false);
      setMessage("Upload one complete .html file with its CSS and JavaScript inside.");
      return;
    }
    const source = await file.text();
    onChange(source);
    validate(source);
  }

  function useStarter() {
    const source = starterCustomHtml(company || "Customer");
    onChange(source);
    setValid(true);
    setMessage("Starter loaded. Edit it here or download it and work locally.");
  }

  function download() {
    const source = value || starterCustomHtml(company || "Customer");
    const blob = new Blob([source], { type: "text/html" });
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = `${slug(company || "customer")}-app.html`;
    anchor.click();
    URL.revokeObjectURL(anchor.href);
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
            CUSTOM HTML APP
          </div>
          <div style={{ fontFamily: f.mono, fontSize: 11, color: c.muted }}>
            build it by hand, paste or upload one self-contained HTML file
          </div>
        </div>
        <Link href="/docs/app-api" target="_blank" style={docsLink}>
          API documentation
        </Link>
      </div>

      <div
        className="cl-theme-workshop-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(300px, 1.2fr) minmax(280px, 0.8fr)",
          gap: 18,
          padding: 16,
        }}
      >
        <div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            <button onClick={() => fileInput.current?.click()} style={darkButton}>
              Upload .html file
            </button>
            <button onClick={useStarter} style={lightButton}>
              Load starter app
            </button>
            <button onClick={download} style={lightButton}>
              Download current file
            </button>
            <input
              ref={fileInput}
              type="file"
              accept=".html,.htm,text/html"
              onChange={(event) => loadFile(event.target.files?.[0] ?? null)}
              hidden
            />
          </div>

          <label style={labelStyle}>
            COMPLETE APP.HTML
            <textarea
              value={value}
              onChange={(event) => {
                onChange(event.target.value);
                setValid(false);
                setMessage(null);
              }}
              placeholder="<!doctype html>..."
              rows={18}
              spellCheck={false}
              style={textArea}
            />
          </label>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button onClick={() => validate()} style={orangeButton}>
              Validate app
            </button>
            {value && (
              <button
                onClick={() => {
                  onChange("");
                  setValid(false);
                  setMessage("Custom app removed. The standard CrewLog app will be used.");
                }}
                style={quietButton}
              >
                use standard app
              </button>
            )}
            {message && (
              <span role={valid ? "status" : "alert"} style={{ fontSize: 12, color: valid ? c.green : c.red }}>
                {message}
              </span>
            )}
          </div>
        </div>

        <div>
          <div style={{ fontFamily: f.mono, fontSize: 11, color: c.muted, marginBottom: 7 }}>
            SANDBOX PREVIEW
          </div>
          {value && valid ? (
            <iframe
              ref={previewFrame}
              title="Custom app preview"
              sandbox="allow-scripts"
              srcDoc={customHtmlDocument(value)}
              style={{
                display: "block",
                width: "100%",
                minHeight: 520,
                border: `1px solid ${c.line}`,
                background: "#fff",
              }}
            />
          ) : (
            <div
              style={{
                minHeight: 520,
                border: `1px solid ${c.line}`,
                background: c.bg,
                padding: 22,
                color: c.muted,
                lineHeight: 1.55,
              }}
            >
              Upload or paste a self-contained HTML file, then validate it to preview.
              Inline CSS and JavaScript are supported. Direct network calls and external
              scripts are blocked. Use <code>window.CrewLog</code> for app data.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontFamily: f.mono,
  fontSize: 11,
  color: c.muted,
  marginBottom: 12,
};
const textArea: React.CSSProperties = {
  display: "block",
  width: "100%",
  marginTop: 7,
  border: `1px solid ${c.line}`,
  borderRadius: 3,
  background: c.bg,
  color: c.ink,
  padding: 11,
  resize: "vertical",
  fontFamily: f.mono,
  fontSize: 11,
  lineHeight: 1.45,
};
const button: React.CSSProperties = {
  borderRadius: 3,
  padding: "9px 12px",
  fontFamily: f.mono,
  fontSize: 11,
  cursor: "pointer",
};
const darkButton: React.CSSProperties = { ...button, border: 0, background: c.ink, color: c.paper };
const lightButton: React.CSSProperties = { ...button, border: `1px solid ${c.line}`, background: c.paper, color: c.ink };
const orangeButton: React.CSSProperties = { ...button, border: 0, background: c.orange, color: c.paper };
const quietButton: React.CSSProperties = { ...button, border: 0, background: "transparent", color: c.muted, textDecoration: "underline" };
const docsLink: React.CSSProperties = { fontFamily: f.mono, fontSize: 11, color: c.orangeDark };
