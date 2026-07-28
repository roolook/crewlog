export const CUSTOM_HTML_FIELD_KEY = "__custom_app_html";
export const CUSTOM_HTML_MAX_BYTES = 5_000_000;

export function validateCustomHtml(
  source: string,
): { ok: true; html: string } | { ok: false; error: string } {
  const html = source.trim();
  if (!html) return { ok: false, error: "Paste or upload an HTML file first." };
  if (new Blob([html]).size > CUSTOM_HTML_MAX_BYTES) {
    return { ok: false, error: "The published app bundle must be smaller than 5 MB." };
  }
  if (!/<(?:!doctype\s+html|html|main|body)\b/i.test(html)) {
    return { ok: false, error: "This does not look like a complete HTML app." };
  }
  const blocked = [
    [/<base\b/i, "base tags"],
    [/<script\b[^>]*\bsrc\s*=/i, "external scripts"],
    [/<link\b[^>]*\bhref\s*=/i, "external stylesheets"],
    [/<(?:iframe|object|embed)\b/i, "embedded pages"],
    [/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(/i, "direct network calls"],
  ] as const;
  const found = blocked.find(([pattern]) => pattern.test(html));
  if (found) {
    return {
      ok: false,
      error: `Custom apps cannot use ${found[1]}. Use the CrewLog bridge instead.`,
    };
  }
  return { ok: true, html };
}

const BRIDGE = `<script>
(() => {
  let sequence = 0;
  const waiting = new Map();
  window.addEventListener("message", event => {
    const message = event.data;
    if (!message || message.source !== "crewlog-host") return;
    if (message.type === "ready") {
      window.dispatchEvent(new Event("crewlog:ready"));
      return;
    }
    if (!message.id) return;
    const request = waiting.get(message.id);
    if (!request) return;
    waiting.delete(message.id);
    message.ok ? request.resolve(message.result) : request.reject(new Error(message.error));
  });
  const call = (method, args = []) => new Promise((resolve, reject) => {
    const id = "cl-" + Date.now() + "-" + (++sequence);
    waiting.set(id, { resolve, reject });
    parent.postMessage({ source: "crewlog-app", id, method, args }, "*");
  });
  window.CrewLog = Object.freeze({
    getContext: () => call("getContext"),
    listEntries: () => call("listEntries"),
    createEntry: values => call("createEntry", [values]),
    updateEntry: (id, values) => call("updateEntry", [id, values]),
    deleteEntry: id => call("deleteEntry", [id]),
    listMembers: () => call("listMembers"),
    inviteMember: contact => call("inviteMember", [contact]),
    removeMember: id => call("removeMember", [id]),
    uploadFile: (fieldKey, file) => call("uploadFile", [fieldKey, file]),
    getFileUrl: path => call("getFileUrl", [path]),
    getCurrentLocation: () => call("getCurrentLocation")
  });
  window.addEventListener("DOMContentLoaded", () => {
    window.dispatchEvent(new Event("crewlog:ready"));
  }, { once: true });
})();
</script>`;

const CSP =
  `<meta http-equiv="Content-Security-Policy" content="` +
  `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; ` +
  `img-src data: blob:; font-src data:; connect-src 'none'; frame-src 'none'; ` +
  `object-src 'none'; base-uri 'none'; form-action 'none'">`;

export function customHtmlDocument(source: string) {
  const validated = validateCustomHtml(source);
  if (!validated.ok) return starterCustomHtml("Custom app");
  const additions = `${CSP}${BRIDGE}`;
  if (/<head\b[^>]*>/i.test(validated.html)) {
    return validated.html.replace(/<head\b[^>]*>/i, (tag) => `${tag}${additions}`);
  }
  if (/<html\b[^>]*>/i.test(validated.html)) {
    return validated.html.replace(/<html\b[^>]*>/i, (tag) => `${tag}<head>${additions}</head>`);
  }
  return `<!doctype html><html><head>${additions}</head><body>${validated.html}</body></html>`;
}

export function starterCustomHtml(company: string) {
  const safeCompany = company.replace(/[<>&"]/g, "");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${safeCompany} App</title>
  <style>
    :root { color-scheme: light; font-family: Arial, sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #f2f0ea; color: #17181b; }
    header { padding: 20px; border-bottom: 2px solid #17181b; background: #fff; }
    main { padding: 20px; }
    button { min-height: 44px; border: 0; padding: 0 16px; background: #17181b; color: #fff; cursor: pointer; }
    .entry { padding: 14px 0; border-bottom: 1px solid #c9c6bd; }
    .error { color: #a52a1a; }
  </style>
</head>
<body>
  <header><strong>${safeCompany}</strong></header>
  <main>
    <h1>Work log</h1>
    <p id="status">Loading entries...</p>
    <div id="entries"></div>
  </main>
  <script>
    async function load() {
      try {
        const context = await CrewLog.getContext();
        const entries = await CrewLog.listEntries();
        document.querySelector("h1").textContent = context.tenant.logLabel;
        document.querySelector("#status").textContent = entries.length + " entries";
        document.querySelector("#entries").innerHTML = entries.map(entry =>
          '<article class="entry"><strong>' + escapeText(entry.title || "Untitled") +
          '</strong><div>#' + entry.entry_no + '</div></article>'
        ).join("");
      } catch (error) {
        document.querySelector("#status").className = "error";
        document.querySelector("#status").textContent = error.message;
      }
    }
    function escapeText(value) {
      const node = document.createElement("div");
      node.textContent = String(value);
      return node.innerHTML;
    }
    window.addEventListener("crewlog:ready", load);
  </script>
</body>
</html>`;
}

declare global {
  interface Window {
    CrewLog?: {
      getContext(): Promise<unknown>;
      listEntries(): Promise<unknown[]>;
    };
  }
}
