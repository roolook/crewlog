"use client";

import Link from "next/link";
import { useState } from "react";
import { c, f } from "@/lib/theme";
import type {
  FieldType,
  PlanTier,
  Tenant,
  TenantField,
  TenantStatus,
} from "@/lib/types";
import type { AppTheme } from "@/lib/app-theme";
import { HumanAppWorkshop } from "../../build/[id]/ThemeWorkshop";
import {
  createTenantApiKey,
  revealTenantApiKey,
  revokeTenantApiKey,
  saveTenantBuild,
  type EditableField,
} from "./actions";

type ManagedTenant = Tenant & {
  monthly_price_cents?: number;
  billing_status?: string;
  api_rate_limit_per_minute?: number;
  current_period_start?: string | null;
  current_period_end?: string | null;
};

const FIELD_TYPES: FieldType[] = [
  "text", "long_text", "number", "currency", "date", "dropdown", "boolean",
  "rating", "location", "photo", "signature", "barcode",
];

export function TenantManager({
  tenant,
  fields: initialFields,
  theme: initialTheme,
  customHtml: initialCustomHtml,
  members,
  usage,
  apiKeys,
}: {
  tenant: ManagedTenant;
  fields: TenantField[];
  theme: AppTheme;
  customHtml: string;
  members: {
    id: string;
    display_name: string;
    email: string | null;
    role: string;
    status: string;
    last_log_at: string | null;
  }[];
  usage: { entries: number; apiMonth: number; storageBytes: number };
  apiKeys: {
    id: string;
    name: string;
    key_prefix: string;
    last_used_at: string | null;
    revoked_at: string | null;
    created_at: string;
    can_reveal: boolean;
  }[];
}) {
  const [name, setName] = useState(tenant.name);
  const [logLabel, setLogLabel] = useState(tenant.log_label);
  const [heroLabel, setHeroLabel] = useState(tenant.hero_label);
  const [status, setStatus] = useState<TenantStatus>(tenant.status);
  const [plan, setPlan] = useState<PlanTier>(tenant.plan_tier);
  const [monthly, setMonthly] = useState((tenant.monthly_price_cents ?? 1000) / 100);
  const [storage, setStorage] = useState(tenant.storage_limit_mb);
  const [rateLimit, setRateLimit] = useState(tenant.api_rate_limit_per_minute ?? 60);
  const [notes, setNotes] = useState(tenant.notes ?? "");
  const [fields, setFields] = useState<EditableField[]>(
    initialFields.map(({ key, label, type, required, on_card, options, is_title, is_status }) => ({
      key, label, type, required, on_card, options, is_title, is_status,
    })),
  );
  const [theme] = useState(initialTheme);
  const [customHtml, setCustomHtml] = useState(initialCustomHtml);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [keyCopied, setKeyCopied] = useState(false);

  async function save() {
    setState("saving");
    setMessage(null);
    const result = await saveTenantBuild({
      tenantId: tenant.id,
      name,
      logLabel,
      heroLabel,
      status,
      planTier: plan,
      monthlyPriceCents: monthly * 100,
      storageLimitMb: storage,
      apiRateLimit: rateLimit,
      notes,
      fields,
      theme,
      customHtml: customHtml || null,
    });
    setState(result.ok ? "saved" : "error");
    setMessage(result.ok ? "Build and tenant settings saved." : result.error);
  }

  function patchField(index: number, patch: Partial<EditableField>) {
    setFields((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  async function generateKey() {
    const result = await createTenantApiKey(tenant.id, "Customer integration");
    if (!result.ok) return setMessage(result.error);
    setNewKey(result.token);
    setKeyCopied(false);
    setMessage("Copy this key now. CrewLog only stores its hash.");
  }

  async function copyKey() {
    if (!newKey) return;
    await navigator.clipboard.writeText(newKey);
    setKeyCopied(true);
  }

  async function revealKey(keyId: string) {
    const result = await revealTenantApiKey(tenant.id, keyId);
    if (!result.ok) return setMessage(result.error);
    setNewKey(result.token);
    setKeyCopied(false);
    setMessage("API key revealed.");
  }

  return (
    <div style={{ maxWidth: 1120 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: f.mono, fontSize: 11, color: c.muted }}>TENANT CONTROL</div>
          <h1 style={{ fontFamily: f.display, fontWeight: 900, margin: "4px 0 4px" }}>{tenant.name}</h1>
          <div style={{ fontFamily: f.mono, fontSize: 12, color: c.muted }}>{tenant.slug}</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
          <a href={`/preview/${tenant.slug}?t=${(tenant as Tenant & {preview_token?: string}).preview_token ?? ""}`} target="_blank" style={link}>Preview</a>
          <a href={`/app/${tenant.slug}`} target="_blank" style={link}>Open app</a>
          <Link href="/ops/tenants" style={link}>All tenants</Link>
        </div>
      </div>

      <div style={metricGrid}>
        <Metric label="BILLING" value={(tenant.billing_status ?? "not started").replace("_", " ")} detail={`$${monthly.toFixed(2)} charged when service starts, then monthly`} />
        <Metric label="USAGE" value={`${usage.entries} entries`} detail={`${usage.apiMonth} API calls in 30 days`} />
        <Metric
          label="STORAGE"
          value={`${formatBytes(usage.storageBytes)} used`}
          detail={`${(storage / 1024).toFixed(1)} GB tenant limit`}
        />
        <Metric label="MEMBERS" value={`${members.filter((m) => m.status === "active").length} active`} detail={`${members.length} total seats`} />
      </div>

      <section style={panel}>
        <h2 style={heading}>APP, BILLING AND LIMITS</h2>
        <div style={formGrid}>
          <Field label="COMPANY"><input value={name} onChange={(e) => setName(e.target.value)} style={input} /></Field>
          <Field label="LOG LABEL"><input value={logLabel} onChange={(e) => setLogLabel(e.target.value)} style={input} /></Field>
          <Field label="HERO LABEL"><input value={heroLabel} onChange={(e) => setHeroLabel(e.target.value)} style={input} /></Field>
          <Field label="LIFECYCLE"><select value={status} onChange={(e) => setStatus(e.target.value as TenantStatus)} style={input}><option value="preview">preview</option><option value="active">active</option><option value="churned">churned</option></select></Field>
          <Field label="PLAN"><select value={plan} onChange={(e) => setPlan(e.target.value as PlanTier)} style={input}><option value="standard">standard</option><option value="custom">custom</option></select></Field>
          <Field label="MONTHLY PRICE"><input type="number" min={0} step="0.01" value={monthly} onChange={(e) => setMonthly(Number(e.target.value))} style={input} /></Field>
          <Field label="STORAGE MB"><input type="number" min={1} value={storage} onChange={(e) => setStorage(Number(e.target.value))} style={input} /></Field>
          <Field label="API CALLS / MIN"><input type="number" min={1} max={10000} value={rateLimit} onChange={(e) => setRateLimit(Number(e.target.value))} style={input} /></Field>
          <Field label="PRIVATE NOTES"><input value={notes} onChange={(e) => setNotes(e.target.value)} style={input} /></Field>
        </div>
        {(tenant.stripe_customer_id || tenant.stripe_subscription_id) && (
          <div style={{ display: "flex", gap: 12, marginTop: 14, flexWrap: "wrap" }}>
            {tenant.stripe_customer_id && (
              <a
                href={`https://dashboard.stripe.com/customers/${tenant.stripe_customer_id}`}
                target="_blank"
                rel="noreferrer"
                style={link}
              >
                Open Stripe customer
              </a>
            )}
            {tenant.stripe_subscription_id && (
              <a
                href={`https://dashboard.stripe.com/subscriptions/${tenant.stripe_subscription_id}`}
                target="_blank"
                rel="noreferrer"
                style={link}
              >
                Manage subscription
              </a>
            )}
          </div>
        )}
      </section>

      <HumanAppWorkshop
        company={name}
        value={customHtml}
        onChange={setCustomHtml}
      />

      <section style={panel}>
        <h2 style={heading}>DATA MODEL</h2>
        {fields.map((field, index) => (
          <div key={field.key} style={{ display: "grid", gridTemplateColumns: "1.1fr .8fr .7fr .7fr 40px", gap: 8, padding: "8px 0", borderBottom: `1px solid ${c.lineFaint}` }}>
            <input value={field.label} onChange={(e) => patchField(index, { label: e.target.value })} style={input} />
            <select value={field.type} onChange={(e) => patchField(index, { type: e.target.value as FieldType })} style={input}>{FIELD_TYPES.map((type) => <option key={type}>{type}</option>)}</select>
            <label style={check}><input type="checkbox" checked={field.required} onChange={() => patchField(index, { required: !field.required })} /> required</label>
            <label style={check}><input type="radio" checked={field.is_title} onChange={() => setFields((rows) => rows.map((row, i) => ({ ...row, is_title: i === index })))} /> title</label>
            <button onClick={() => setFields((rows) => rows.filter((_, i) => i !== index))} style={remove}>×</button>
          </div>
        ))}
        <button onClick={() => setFields((rows) => [...rows, { key: `field_${rows.length + 1}`, label: "New field", type: "text", required: false, on_card: true, options: [], is_title: rows.length === 0, is_status: false }])} style={linkButton}>Add field</button>
      </section>

      <section style={panel}>
        <h2 style={heading}>APP API KEY</h2>
        <p style={{ color: c.muted, lineHeight: 1.5 }}>
          Use <code>Authorization: Bearer KEY</code> with <code>/api/v1/{tenant.slug}/entries</code>.
          GET lists entries and POST creates one. Calls are limited to this app, audited,
          revocable and limited to {rateLimit} per minute.{" "}
          <Link href="/docs/app-api" target="_blank" style={{ color: c.ink }}>Open API documentation</Link>.
        </p>
        <div style={{ padding: 12, marginBottom: 12, background: c.bg, border: `1px solid ${c.lineFaint}`, fontSize: 13, lineHeight: 1.5 }}>
          Active keys created now can be revealed again by an operator. Older
          hash-only keys need one replacement before repeat reveal is available.
        </div>
        <button onClick={generateKey} style={darkButton}>
          {apiKeys.some((key) => !key.revoked_at) ? "Create replacement key" : "Create API key"}
        </button>
        {newKey && (
          <div style={{ marginTop: 12, border: `2px solid ${c.ink}`, padding: 12 }}>
            <div style={{ fontFamily: f.mono, fontSize: 11, fontWeight: 700, marginBottom: 8 }}>
              API KEY
            </div>
            <pre style={{ ...secret, margin: "0 0 10px" }}>{newKey}</pre>
            <button onClick={copyKey} style={linkButton}>{keyCopied ? "Copied" : "Copy API key"}</button>
          </div>
        )}
        <div style={{ marginTop: 14, fontFamily: f.mono, fontSize: 10, color: c.muted }}>KEYS FOR THIS APP</div>
        {apiKeys.length === 0 && (
          <p style={{ color: c.muted, fontSize: 13 }}>No API keys have been created yet.</p>
        )}
        {apiKeys.map((key) => (
          <div key={key.id} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: `1px solid ${c.lineFaint}`, fontFamily: f.mono, fontSize: 12 }}>
            <span>{key.name} · {key.key_prefix}… · {key.revoked_at ? "revoked" : key.last_used_at ? "used" : "unused"}</span>
            {!key.revoked_at && (
              <span style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => revealKey(key.id)}
                  disabled={!key.can_reveal}
                  style={removeText}
                  title={
                    key.can_reveal
                      ? "Reveal this key"
                      : "Create a replacement once to enable repeat reveal"
                  }
                >
                  {key.can_reveal ? "reveal" : "legacy key"}
                </button>
                <button onClick={() => revokeTenantApiKey(tenant.id, key.id)} style={removeText}>revoke</button>
              </span>
            )}
          </div>
        ))}
      </section>

      <section style={panel}>
        <h2 style={heading}>MEMBERS</h2>
        {members.map((member) => <div key={member.id} style={{ padding: "8px 0", borderBottom: `1px solid ${c.lineFaint}` }}><strong>{member.display_name}</strong> <span style={{ color: c.muted }}>{member.email ?? ""} · {member.role} · {member.status}</span></div>)}
      </section>

      <div style={{ position: "sticky", bottom: 16, display: "flex", alignItems: "center", gap: 12, background: c.paper, border: `1px solid ${c.line}`, padding: 12 }}>
        <button onClick={save} disabled={state === "saving"} style={darkButton}>{state === "saving" ? "Saving..." : "Save all changes"}</button>
        {message && <span role={state === "error" ? "alert" : "status"} style={{ color: state === "error" ? c.red : c.green }}>{message}</span>}
      </div>
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div style={panel}><div style={{ fontFamily: f.mono, fontSize: 10, color: c.muted }}>{label}</div><div style={{ fontFamily: f.display, fontWeight: 900, fontSize: 20, margin: "5px 0" }}>{value}</div><div style={{ fontSize: 12, color: c.muted }}>{detail}</div></div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={{ fontFamily: f.mono, fontSize: 10, color: c.muted }}>{label}{children}</label>;
}
function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
const panel: React.CSSProperties = { background: c.paper, border: `1px solid ${c.line}`, borderRadius: 4, padding: 16, margin: "18px 0" };
const metricGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10, marginTop: 20 };
const formGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 };
const heading: React.CSSProperties = { fontFamily: f.display, fontWeight: 900, fontSize: 16, margin: "0 0 14px" };
const input: React.CSSProperties = { display: "block", width: "100%", marginTop: 5, border: `1px solid ${c.line}`, borderRadius: 3, padding: "9px 10px", background: c.paper, color: c.ink };
const check: React.CSSProperties = { display: "flex", alignItems: "center", gap: 5, fontFamily: f.mono, fontSize: 11 };
const link: React.CSSProperties = { color: c.ink, border: `1px solid ${c.line}`, padding: "9px 11px", textDecoration: "none", fontFamily: f.mono, fontSize: 11 };
const linkButton: React.CSSProperties = { ...link, background: c.paper, marginTop: 12 };
const darkButton: React.CSSProperties = { background: c.ink, color: c.paper, border: 0, borderRadius: 3, padding: "10px 14px", fontFamily: f.mono, cursor: "pointer" };
const remove: React.CSSProperties = { border: 0, background: "transparent", color: c.red, fontSize: 20, cursor: "pointer" };
const removeText: React.CSSProperties = { border: 0, background: "transparent", color: c.red, fontFamily: f.mono, cursor: "pointer" };
const secret: React.CSSProperties = { padding: 12, background: c.bg, border: `1px solid ${c.line}`, overflowWrap: "anywhere", whiteSpace: "pre-wrap" };
