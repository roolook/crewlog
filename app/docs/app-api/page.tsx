import Link from "next/link";
import { c, f } from "@/lib/theme";

export const metadata = {
  title: "Custom App Projects - CrewLog",
  description: "Build a complete app project on top of the CrewLog tenant API.",
};

const methods = [
  ["getContext()", "Tenant identity, field definitions and the signed-in viewer."],
  ["listEntries()", "All currently loaded, non-deleted entries."],
  ["createEntry(values)", "Creates an entry using field keys from getContext()."],
  ["updateEntry(id, values)", "Replaces the editable values for one entry."],
  ["deleteEntry(id)", "Soft-deletes an entry. Owners retain recovery options."],
  ["listMembers()", "Current active and pending tenant members."],
  ["inviteMember(contact)", "Owner only. Accepts an email address or phone number."],
  ["removeMember(id)", "Owner only. Removes a member from this tenant."],
  ["uploadFile(fieldKey, file)", "Uploads an image to a photo or signature field. Maximum 10 MB."],
  ["getFileUrl(path)", "Returns a one-hour signed URL for a tenant file."],
  ["getCurrentLocation()", "Requests the device location through the trusted host page."],
] as const;

export default function CustomAppApiDocs() {
  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "48px 20px 90px" }}>
      <div style={{ fontFamily: f.mono, fontSize: 11, color: c.muted }}>
        CREWLOG DEVELOPER DOCUMENTATION · APP BRIDGE V1
      </div>
      <h1 style={{ fontFamily: f.display, fontWeight: 900, fontSize: 38, margin: "8px 0 12px" }}>
        Build a complete customer app
      </h1>
      <p style={lead}>
        Build with separate HTML, CSS, JavaScript, images and fonts, then upload
        the production build folder or a zip. CrewLog packages the project, runs it
        inside an isolated browser sandbox and supplies tenant data through{" "}
        <code>window.CrewLog</code>.
      </p>

      <Notice>
        Never put Supabase, Clerk, Stripe, Vercel or other private credentials in
        the HTML file. A custom app receives only the tenant-scoped methods below.
      </Notice>

      <Section title="Project requirements">
        <ul style={list}>
          <li>A production build folder or zip containing <code>index.html</code>.</li>
          <li>Separate local CSS, JavaScript, images and font files are supported.</li>
          <li>React, Vue, Svelte and similar apps should be uploaded from their compiled <code>dist</code> or <code>build</code> folder.</li>
          <li>Disable code splitting so the production build has one browser JavaScript bundle.</li>
          <li>The packaged app must be no larger than 5 MB.</li>
          <li>No external scripts, stylesheets, iframes or embedded pages.</li>
          <li>No direct fetch, XMLHttpRequest, WebSocket or EventSource calls.</li>
          <li>Use the CrewLog bridge for every data operation.</li>
          <li>Design for a phone viewport and include loading, empty and error states.</li>
        </ul>
      </Section>

      <Section title="Starting the app">
        <Code>{`window.addEventListener("crewlog:ready", async () => {
  try {
    const context = await CrewLog.getContext();
    const entries = await CrewLog.listEntries();
    render(context, entries);
  } catch (error) {
    showError(error.message);
  }
});`}</Code>
        <p style={body}>
          Do not call the bridge before <code>crewlog:ready</code>. Every method
          returns a Promise and rejects with a human-readable error.
        </p>
      </Section>

      <Section title="Available methods">
        <div style={{ borderTop: `2px solid ${c.ink}` }}>
          {methods.map(([method, detail]) => (
            <div key={method} style={methodRow}>
              <code style={{ fontWeight: 700 }}>{method}</code>
              <span style={{ color: c.body }}>{detail}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Context shape">
        <Code>{`{
  tenant: {
    id: "uuid",
    slug: "acme-electric",
    name: "Acme Electric",
    logLabel: "SERVICE CALLS",
    status: "active"
  },
  fields: [
    {
      key: "customer",
      label: "Customer",
      type: "text",
      required: true,
      options: [],
      is_title: true,
      is_status: false
    }
  ],
  viewer: { role: "owner", name: "Avery" }
}`}</Code>
      </Section>

      <Section title="Entry shape">
        <Code>{`{
  id: "uuid",
  tenant_id: "uuid",
  entry_no: 42,
  title: "Smith residence",
  status_value: "Scheduled",
  data: {
    customer: "Smith residence",
    scheduled_for: "2026-07-29",
    urgent: true
  },
  created_by_name: "Avery",
  created_at: "2026-07-28T20:00:00.000Z",
  updated_at: "2026-07-28T20:00:00.000Z"
}`}</Code>
      </Section>

      <Section title="Create, edit and delete">
        <Code>{`const created = await CrewLog.createEntry({
  customer: "Smith residence",
  scheduled_for: "2026-07-29",
  urgent: true
});

const updated = await CrewLog.updateEntry(created.id, {
  ...created.data,
  urgent: false
});

await CrewLog.deleteEntry(created.id);`}</Code>
        <p style={body}>
          The keys must match <code>context.fields[].key</code>. CrewLog validates
          required values, dropdown options, locations and stored-file paths on
          the server. Unknown keys are discarded.
        </p>
      </Section>

      <Section title="Field values">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 8 }}>
          {[
            ["text, long_text, dropdown, date", "string or null"],
            ["number, currency", "number or null"],
            ["boolean", "true, false or null"],
            ["rating", "0 through 5, or a configured option"],
            ["location", '{ lat: number, lng: number, label?: string }'],
            ["photo, signature", "{ path: string } supplied by CrewLog upload UI"],
            ["barcode", "string or null"],
          ].map(([name, shape]) => (
            <div key={name} style={{ border: `1px solid ${c.line}`, padding: 12 }}>
              <code>{name}</code>
              <div style={{ marginTop: 5, color: c.muted, fontSize: 13 }}>{shape}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Photos and signatures">
        <Code>{`const input = document.querySelector("#photo");
input.addEventListener("change", async () => {
  const file = input.files[0];
  const stored = await CrewLog.uploadFile("completion_photo", file);
  const entry = await CrewLog.createEntry({
    customer: "Smith residence",
    completion_photo: stored
  });

  const signed = await CrewLog.getFileUrl(entry.data.completion_photo.path);
  document.querySelector("#preview").src = signed.url;
});`}</Code>
        <p style={body}>
          Uploads accept image files up to 10 MB. CrewLog stores them inside the
          current tenant namespace and enforces the tenant storage limit.
        </p>
      </Section>

      <Section title="Device location">
        <Code>{`const position = await CrewLog.getCurrentLocation();
await CrewLog.createEntry({
  customer: "Smith residence",
  job_location: {
    lat: position.lat,
    lng: position.lng,
    label: "Meter box"
  }
});`}</Code>
      </Section>

      <Section title="External REST API">
        <p style={body}>
          Server-to-server integrations use a tenant API key created under
          Ops → Tenants. Do not put this key inside uploaded HTML. The iframe
          bridge already has the signed-in user&apos;s tenant scope.
        </p>
        <Code>{`GET /api/v1/{tenantSlug}/entries
Authorization: Bearer cl_live_...

POST /api/v1/{tenantSlug}/entries
Authorization: Bearer cl_live_...
Content-Type: application/json

{
  "title": "Smith residence",
  "status": "Scheduled",
  "data": {
    "customer": "Smith residence",
    "scheduled_for": "2026-07-29"
  }
}`}</Code>
        <p style={body}>
          GET returns <code>{`{ data: Entry[], limit: number }`}</code>. POST
          returns <code>{`{ data: Entry }`}</code> with status 201. Keys are
          hashed, tenant-scoped, revocable and rate-limited. A 429 response
          includes <code>Retry-After: 60</code>.
        </p>
      </Section>

      <Section title="Security model">
        <ul style={list}>
          <li>
            The iframe uses <code>sandbox=&quot;allow-scripts&quot;</code>{" "}
            without same-origin access.
          </li>
          <li>A strict Content Security Policy blocks network and embedding APIs.</li>
          <li>The host accepts a fixed method allowlist and ignores other messages.</li>
          <li>Signed-in app writes still pass through Supabase Row Level Security.</li>
          <li>Owner-only member actions are enforced again on the server.</li>
          <li>Preview mode supplies real rows but disables writes.</li>
        </ul>
      </Section>

      <Section title="Publishing workflow">
        <ol style={list}>
          <li>Open a tenant under <Link href="/ops/tenants">Ops → Tenants</Link>.</li>
          <li>Build the app locally with the framework or tools you prefer.</li>
          <li>Create a static production build with code splitting disabled.</li>
          <li>Upload the build folder or zip from the custom app project panel.</li>
          <li>Select Validate app and inspect the sandbox preview.</li>
          <li>Select Save all changes. The tenant app switches immediately.</li>
          <li>Use “use standard app” and save to roll back.</li>
        </ol>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section style={{ marginTop: 42 }}><h2 style={heading}>{title}</h2>{children}</section>;
}
function Code({ children }: { children: string }) {
  return <pre style={code}><code>{children}</code></pre>;
}
function Notice({ children }: { children: React.ReactNode }) {
  return <div style={{ marginTop: 24, border: `2px solid ${c.orangeDark}`, background: c.orangeBg, padding: 16, lineHeight: 1.5 }}>{children}</div>;
}
const lead: React.CSSProperties = { fontSize: 18, color: c.body, lineHeight: 1.6, maxWidth: 720 };
const body: React.CSSProperties = { color: c.body, lineHeight: 1.6 };
const heading: React.CSSProperties = { fontFamily: f.display, fontWeight: 900, fontSize: 22, margin: "0 0 14px", borderBottom: `1px solid ${c.line}`, paddingBottom: 8 };
const list: React.CSSProperties = { color: c.body, lineHeight: 1.7, paddingLeft: 22 };
const code: React.CSSProperties = { overflowX: "auto", whiteSpace: "pre", background: c.ink, color: c.paper, padding: 16, borderRadius: 3, fontFamily: f.mono, fontSize: 12, lineHeight: 1.55 };
const methodRow: React.CSSProperties = { display: "grid", gridTemplateColumns: "minmax(180px, .7fr) minmax(260px, 1.3fr)", gap: 16, padding: "12px 8px", borderBottom: `1px solid ${c.line}`, alignItems: "baseline" };
