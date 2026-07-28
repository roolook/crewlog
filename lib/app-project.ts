import JSZip from "jszip";

type ProjectFile = { path: string; bytes: Uint8Array };

const TEXT_EXTENSIONS = new Set([
  "html", "htm", "css", "js", "mjs", "json", "svg", "txt",
]);

export async function projectFilesFromSelection(files: FileList | File[]) {
  const selected = Array.from(files);
  if (!selected.length) throw new Error("Choose an app project first.");
  if (selected.length === 1 && /\.zip$/i.test(selected[0].name)) {
    const zip = await JSZip.loadAsync(await selected[0].arrayBuffer());
    const rows: ProjectFile[] = [];
    for (const [path, item] of Object.entries(zip.files)) {
      if (item.dir || path.includes("__MACOSX/")) continue;
      rows.push({ path, bytes: await item.async("uint8array") });
    }
    return rows;
  }
  return Promise.all(
    selected.map(async (file) => ({
      path:
        (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
        file.name,
      bytes: new Uint8Array(await file.arrayBuffer()),
    })),
  );
}

/**
 * Turns a normal static production build into the isolated document CrewLog
 * stores and runs. Authors keep separate source files; compilation is an
 * implementation detail of publishing, not an authoring constraint.
 */
export async function compileAppProject(input: ProjectFile[]) {
  const files = normalizeProject(input);
  const indexPath =
    [...files.keys()].find((path) => path === "index.html") ??
    [...files.keys()].find((path) => path.endsWith("/index.html"));
  if (!indexPath) {
    throw new Error("The project needs an index.html file.");
  }

  const root = indexPath.slice(0, -"index.html".length);
  const html = text(files.get(indexPath)!, indexPath);
  const document = new DOMParser().parseFromString(html, "text/html");
  const head = document.head || document.documentElement.prepend(document.createElement("head"));

  for (const link of Array.from(document.querySelectorAll('link[rel="stylesheet"][href]'))) {
    const href = link.getAttribute("href") ?? "";
    if (isExternal(href)) {
      throw new Error("External stylesheets are not supported. Include the CSS in the project.");
    }
    const path = resolveProjectPath(root, indexPath, href);
    const bytes = files.get(path);
    if (!bytes) throw new Error(`Missing stylesheet: ${href}`);
    const style = document.createElement("style");
    style.textContent = await rewriteCssAssets(text(bytes, path), path, root, files);
    link.replaceWith(style);
  }

  for (const script of Array.from(document.querySelectorAll("script[src]"))) {
    const src = script.getAttribute("src") ?? "";
    if (isExternal(src)) {
      throw new Error("External scripts are not supported. Include the production bundle in the project.");
    }
    const path = resolveProjectPath(root, indexPath, src);
    const bytes = files.get(path);
    if (!bytes) throw new Error(`Missing script: ${src}`);
    const source = text(bytes, path);
    if (hasLocalModuleImports(source)) {
      throw new Error(
        "This JavaScript build still has split module imports. Build it as one browser bundle, then upload the dist folder.",
      );
    }
    script.removeAttribute("src");
    script.textContent = source.replace(/<\/script/gi, "<\\/script");
  }

  for (const style of Array.from(document.querySelectorAll("style"))) {
    style.textContent = await rewriteCssAssets(style.textContent ?? "", indexPath, root, files);
  }

  const assetAttributes = [
    ["img", "src"],
    ["source", "src"],
    ["video", "poster"],
    ['link[rel="icon"]', "href"],
    ['link[rel="apple-touch-icon"]', "href"],
  ] as const;
  for (const [selector, attribute] of assetAttributes) {
    for (const node of Array.from(document.querySelectorAll(`${selector}[${attribute}]`))) {
      const value = node.getAttribute(attribute) ?? "";
      if (!value || isExternal(value) || value.startsWith("data:") || value.startsWith("blob:")) continue;
      const path = resolveProjectPath(root, indexPath, value);
      const bytes = files.get(path);
      if (!bytes) throw new Error(`Missing project asset: ${value}`);
      node.setAttribute(attribute, dataUrl(bytes, path));
    }
  }

  for (const link of Array.from(document.querySelectorAll("link"))) {
    if (!["stylesheet", "icon", "apple-touch-icon"].includes(link.getAttribute("rel") ?? "")) {
      link.remove();
    }
  }

  if (!head.querySelector('meta[name="viewport"]')) {
    const viewport = document.createElement("meta");
    viewport.setAttribute("name", "viewport");
    viewport.setAttribute("content", "width=device-width, initial-scale=1");
    head.prepend(viewport);
  }

  return "<!doctype html>\n" + document.documentElement.outerHTML;
}

function normalizeProject(input: ProjectFile[]) {
  const map = new Map<string, Uint8Array>();
  for (const file of input) {
    const path = normalize(file.path);
    if (!path || path.endsWith("/")) continue;
    map.set(path, file.bytes);
  }
  return map;
}

function resolveProjectPath(root: string, from: string, reference: string) {
  const clean = decodeURIComponent(reference.split(/[?#]/)[0]);
  if (clean.startsWith("/")) return normalize(root + clean.slice(1));
  const base = from.slice(0, from.lastIndexOf("/") + 1);
  return normalize(base + clean);
}

function normalize(path: string) {
  const parts: string[] = [];
  for (const part of path.replaceAll("\\", "/").split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return parts.join("/");
}

async function rewriteCssAssets(
  css: string,
  cssPath: string,
  root: string,
  files: Map<string, Uint8Array>,
) {
  const matches = [...css.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi)];
  let output = css;
  for (const match of matches) {
    const reference = match[2].trim();
    if (isExternal(reference) || reference.startsWith("data:") || reference.startsWith("#")) continue;
    const path = resolveProjectPath(root, cssPath, reference);
    const bytes = files.get(path);
    if (!bytes) throw new Error(`Missing CSS asset: ${reference}`);
    output = output.replace(match[0], `url("${dataUrl(bytes, path)}")`);
  }
  return output.replace(/<\/style/gi, "<\\/style");
}

function text(bytes: Uint8Array, path: string) {
  const extension = path.split(".").pop()?.toLowerCase() ?? "";
  if (!TEXT_EXTENSIONS.has(extension)) {
    throw new Error(`${path} is not a text file.`);
  }
  return new TextDecoder().decode(bytes);
}

function dataUrl(bytes: Uint8Array, path: string) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return `data:${mime(path)};base64,${btoa(binary)}`;
}

function mime(path: string) {
  const extension = path.split(".").pop()?.toLowerCase();
  return {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    avif: "image/avif",
    ico: "image/x-icon",
    woff: "font/woff",
    woff2: "font/woff2",
    ttf: "font/ttf",
    mp4: "video/mp4",
    webm: "video/webm",
  }[extension ?? ""] ?? "application/octet-stream";
}

function isExternal(value: string) {
  return /^(?:https?:|\/\/|mailto:|tel:|javascript:)/i.test(value);
}

function hasLocalModuleImports(source: string) {
  return /\b(?:import\s*(?:\(|[\s\S]*?\bfrom\s*)|export\s+[\s\S]*?\bfrom\s*)["'](?:\.{0,2}\/)/m.test(source);
}
