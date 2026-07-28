# CrewLog custom app bridge v1

The canonical, rendered documentation lives at `/docs/app-api`.

A custom app is one self-contained HTML file with inline CSS and JavaScript.
CrewLog stores it with the tenant and renders it in an iframe sandbox. The app
must wait for the `crewlog:ready` event, then use `window.CrewLog`.

Available Promise-returning methods:

- `getContext()`
- `listEntries()`
- `createEntry(values)`
- `updateEntry(id, values)`
- `deleteEntry(id)`
- `listMembers()`
- `inviteMember(contact)`
- `removeMember(id)`
- `uploadFile(fieldKey, file)`
- `getFileUrl(path)`
- `getCurrentLocation()`

Custom HTML never receives provider credentials or direct database access.
Direct network calls, external scripts, external stylesheets and embedded pages
are rejected. Signed-in mutations still pass through CrewLog server actions and
Supabase Row Level Security.

External systems use the tenant-scoped REST endpoint at
`/api/v1/{tenantSlug}/entries` with a revocable `cl_live_...` bearer key.
