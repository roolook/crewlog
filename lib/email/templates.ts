/**
 * The five transactional emails, exactly as specced in the design doc:
 * plain, text-forward, human-sent. Light HTML, no marketing chrome.
 *
 * Built as strings rather than React so they can be table-based and
 * inline-styled the way mail clients demand. Each returns a subject plus both
 * an HTML and a plain-text body.
 *
 * The from/subject header is *not* baked into the body — real mail clients draw
 * that themselves. The ops gallery at /ops/emails renders it as chrome around
 * the preview instead.
 */

import { siteUrl } from "@/lib/format";

export type RenderedEmail = {
  template: string;
  subject: string;
  html: string;
  text: string;
  from: string;
  replyTo: string;
};

/**
 * Sender addresses default to Resend's shared sandbox domain, which needs no
 * DNS setup but can only deliver to your own Resend account address — see
 * lib/email/send.ts. Point these at your own domain once one is verified.
 * Replies always go to a human address regardless of who sent the mail.
 */
const BUILD_FROM = () =>
  process.env.EMAIL_FROM_BUILD ?? "CrewLog <onboarding@resend.dev>";
const LOG_FROM = () =>
  process.env.EMAIL_FROM_LOG ?? "CrewLog <onboarding@resend.dev>";
const REPLY_TO = () => process.env.EMAIL_REPLY_TO ?? "build@crewlog.app";

const INK = "#17181B";
const BODY = "#34342F";
const MUTED = "#6E6C66";
const PAPER = "#FBFAF7";
const LINE = "#C9C6BD";
const ORANGE = "#F4551E";

/** Shared shell: a cream card on a warm background, one column, 520px. */
function shell(inner: string) {
  return `<!doctype html>
<html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
</head>
<body style="margin:0;padding:24px 12px;background:#E4E1D9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
<tr><td align="center">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="520" style="width:520px;max-width:100%;background:${PAPER};border:1px solid ${LINE};border-radius:4px;">
<tr><td style="padding:18px 20px 10px;border-bottom:1px solid #E4E1D9;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
    <td style="width:12px;height:12px;background:${ORANGE};font-size:0;line-height:0;">&nbsp;</td>
    <td style="padding-left:8px;font-weight:900;font-size:15px;letter-spacing:0.02em;color:${INK};">CREWLOG</td>
  </tr></table>
</td></tr>
${inner}
</table>
<div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:${MUTED};padding:16px 8px 0;">
a person built this · <a href="mailto:${REPLY_TO()}" style="color:${MUTED};">${REPLY_TO()}</a>
</div>
</td></tr></table>
</body></html>`;
}

function button(href: string, label: string, dark = false) {
  return `<a href="${href}" style="display:block;background:${dark ? INK : ORANGE};color:${PAPER};text-decoration:none;font-weight:700;font-size:16px;padding:15px;border-radius:5px;text-align:center;">${label}</a>`;
}

const p = (s: string, extra = "") =>
  `<p style="margin:0 0 14px;font-size:15.5px;line-height:1.6;color:${BODY};${extra}">${s}</p>`;

const mono = (s: string) =>
  `<span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13.5px;">${escapeHtml(s)}</span>`;

export function escapeHtml(s: string) {
  return s.replace(
    /[&<>"']/g,
    (ch) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[ch]!,
  );
}

const firstName = (full: string) =>
  escapeHtml(full.trim().split(/\s+/)[0] ?? "there");

// ── 1 / RECEIVED ────────────────────────────────────────────────────────────

export function receivedEmail(args: {
  name: string;
  fileName: string | null;
}): RenderedEmail {
  const who = firstName(args.name);
  const file = args.fileName
    ? `Your file (${mono(args.fileName)}) is in.`
    : `Your note is in — send the sheet to ${escapeHtml(REPLY_TO())} whenever it's handy.`;

  return {
    template: "received",
    subject: "Got your spreadsheet — building now",
    from: BUILD_FROM(),
    replyTo: REPLY_TO(),
    html: shell(
      `<tr><td style="padding:22px 20px 26px;position:relative;">
${p(`${who} —`)}
${p(`${file} A person is turning it into your app right now.`)}
${p(`<strong>What happens next:</strong> within 48 hours you get one email — “Your app is ready” — with a link. Your data will already be inside.`)}
${p(`<strong>What you need to do in the meantime:</strong> nothing.`)}
${p(`— CrewLog`, "margin:0;")}
<div style="position:absolute;top:16px;right:18px;font-weight:900;font-size:14px;letter-spacing:0.05em;color:${ORANGE};border:3px solid ${ORANGE};padding:2px 8px;opacity:0.85;">RECEIVED</div>
</td></tr>`,
    ),
    text: `${args.name.trim().split(/\s+/)[0] ?? "there"} —

${args.fileName ? `Your file (${args.fileName}) is in.` : "Your note is in."} A person is turning it into your app right now.

What happens next: within 48 hours you get one email — "Your app is ready" — with a link. Your data will already be inside.

What you need to do in the meantime: nothing.

— CrewLog`,
  };
}

// ── 2 / PREVIEW READY (the conversion email) ────────────────────────────────

export function previewReadyEmail(args: {
  name: string;
  /** Full preview URL including the ?t= token — the link *is* the credential. */
  previewUrl: string;
  rowCount: number;
  columnCount: number;
  hours: number;
}): RenderedEmail {
  const who = firstName(args.name);
  const setup = process.env.NEXT_PUBLIC_SETUP_FEE ?? "99";
  const monthly = process.env.NEXT_PUBLIC_MONTHLY_FEE ?? "10";

  return {
    template: "preview_ready",
    subject: "Your app is ready — built from your spreadsheet",
    from: BUILD_FROM(),
    replyTo: REPLY_TO(),
    html: shell(
      `<tr><td style="padding:22px 20px 26px;">
${p(`${who} — it's done. ${args.rowCount} rows, ${args.columnCount} columns, all in. Took us ${args.hours} hours.`)}
${button(args.previewUrl, "Open my app")}
${p(`Free to use as long as you like. Activating for the crew is $${setup} + $${monthly}/mo (25 GB storage).`, `margin:14px 0 0;font-size:13.5px;color:${MUTED};font-style:italic;`)}
</td></tr>`,
    ),
    text: `${args.name.trim().split(/\s+/)[0] ?? "there"} — it's done. ${args.rowCount} rows, ${args.columnCount} columns, all in. Took us ${args.hours} hours.

Open your app: ${args.previewUrl}

Free to use as long as you like. Activating for the crew is $${setup} + $${monthly}/mo (25 GB storage).`,
  };
}

// ── 3 / MAGIC LINK ──────────────────────────────────────────────────────────
// Supabase Auth sends the real OTP mail; this is the template to paste into
// Auth → Email Templates so it matches the rest of the system.

export function magicLinkEmail(args: {
  tenantName: string;
  url: string;
}): RenderedEmail {
  return {
    template: "magic_link",
    subject: `Your ${args.tenantName} log link`,
    from: LOG_FROM(),
    replyTo: REPLY_TO(),
    html: shell(
      `<tr><td style="padding:22px 20px 26px;">
${button(args.url, "Open the log", true)}
${p(`expires in 15 minutes · stays signed in 90 days on your phone`, `margin:14px 0 0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px;color:${MUTED};`)}
</td></tr>`,
    ),
    text: `Open the log: ${args.url}

Expires in 15 minutes. Stays signed in 90 days on your phone.`,
  };
}

// ── 4 / CREW INVITE ─────────────────────────────────────────────────────────

export function crewInviteEmail(args: {
  inviterName: string;
  tenantName: string;
  url: string;
  logLabel: string;
}): RenderedEmail {
  const what =
    args.logLabel.toLowerCase().replace(/\blog\b/, "").trim() || "work";

  return {
    template: "crew_invite",
    subject: `${args.inviterName} added you to the ${args.tenantName} log`,
    from: LOG_FROM(),
    replyTo: REPLY_TO(),
    html: shell(
      `<tr><td style="padding:22px 20px 26px;">
${p(`It's where the crew logs ${escapeHtml(what)}. Takes 10 seconds an entry.`, "margin:0 0 16px;")}
${button(args.url, "Open the log")}
${p(`no password · no app store · pins to your home screen`, `margin:14px 0 0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px;color:${MUTED};`)}
</td></tr>`,
    ),
    text: `${args.inviterName} added you to the ${args.tenantName} log.

It's where the crew logs ${what}. Takes 10 seconds an entry.

Open the log: ${args.url}

No password, no app store. Pins to your home screen.`,
  };
}

// ── 5 / ACTIVATION RECEIPT ──────────────────────────────────────────────────

export function activationReceiptEmail(args: {
  name: string;
  tenantName: string;
  operatorName?: string;
}): RenderedEmail {
  const setup = Number(process.env.NEXT_PUBLIC_SETUP_FEE ?? 99);
  const monthly = Number(process.env.NEXT_PUBLIC_MONTHLY_FEE ?? 10);

  const row = (label: string, amount: string, bold = false) =>
    `<tr><td style="padding:${bold ? "8px 0 0" : "3px 0"};${bold ? "border-top:1px solid #E4E1D9;font-weight:600;" : ""}">${label}</td>` +
    `<td align="right" style="padding:${bold ? "8px 0 0" : "3px 0"};${bold ? "border-top:1px solid #E4E1D9;font-weight:600;" : ""}">${amount}</td></tr>`;

  return {
    template: "activation_receipt",
    subject: `${args.tenantName} is active — receipt inside`,
    from: BUILD_FROM(),
    replyTo: REPLY_TO(),
    html: shell(
      `<tr><td style="padding:22px 20px 26px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;border:1px solid #E4E1D9;border-radius:4px;color:${BODY};margin-bottom:16px;">
<tr><td style="padding:12px 14px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
${row("Setup (one time)", `$${setup.toFixed(2)}`)}
${row("Monthly (25 GB storage, unlimited crew)", `$${monthly.toFixed(2)}`)}
${row("Charged today", `$${(setup + monthly).toFixed(2)}`, true)}
</table></td></tr></table>
${p(`Reply to this email for any change, any time — a new column, a renamed dropdown, a whole second log. A person reads it.`)}
${p(`— ${escapeHtml(args.operatorName ?? "CrewLog")}`, "margin:0;")}
</td></tr>`,
    ),
    text: `${args.tenantName} is active.

Setup (one time)                        $${setup.toFixed(2)}
Monthly (25 GB, unlimited crew)         $${monthly.toFixed(2)}
Charged today                           $${(setup + monthly).toFixed(2)}

Reply to this email for any change, any time — a new column, a renamed dropdown, a whole second log. A person reads it.

— ${args.operatorName ?? "CrewLog"}`,
  };
}

/** Every template, rendered with sample data, for the ops email gallery. */
export function sampleEmails(): RenderedEmail[] {
  return [
    receivedEmail({ name: "Sofia H.", fileName: "tools-2026.xlsx" }),
    previewReadyEmail({
      name: "Sofia H.",
      previewUrl: `${siteUrl()}/preview/sample-contracting?t=PREVIEW_TOKEN`,
      rowCount: 87,
      columnCount: 5,
      hours: 26,
    }),
    magicLinkEmail({
      tenantName: "Sample Contracting Co.",
      url: `${siteUrl()}/login`,
    }),
    crewInviteEmail({
      inviterName: "Sofia H.",
      tenantName: "Sample Contracting Co.",
      url: `${siteUrl()}/login`,
      logLabel: "TOOL LOG",
    }),
    activationReceiptEmail({
      name: "Sofia H.",
      tenantName: "Sample Contracting Co.",
      operatorName: "Alex",
    }),
  ];
}
