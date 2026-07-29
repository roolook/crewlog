# CrewLog Website Audit Prompt

## Context
You are auditing **CrewLog**, a Next.js 15 (App Router) application that converts spreadsheets into custom phone apps for field teams. The codebase is in the current folder. This is a full-stack application using:

- **Framework:** Next.js 15 with React 19, TypeScript, App Router
- **Deployment target:** Vercel
- **Database & Auth:** Supabase (Postgres + Row-Level Security)
- **Identity Provider:** Clerk (with fallback to Supabase auth)
- **Email:** Resend (with log-only fallback)
- **Payments:** Stripe (currently stubbed)
- **Maps:** MapLibre GL JS + MapTiler tiles
- **Styling:** Custom CSS (no Tailwind, no component library)
- **File parsing:** SheetJS (xlsx)

## Application Structure
- `/` — Landing page (hero animation, cost calculator, capabilities, pricing, FAQ)
- `/demo` — Fully interactive demo app (embedded in landing page iframe)
- `/start` — Intake form (file upload, capability pick-list, prompts)
- `/login` — Magic link login
- `/app` / `/app/[slug]` — The product (generated or custom tenant apps)
- `/preview/[slug]` — Preview link emailed to customers
- `/ops` — Operator console (build screen, tenants, changes, emails)
- `/api/*` — API routes (CSV export, Stripe webhook, entries API)

## Your Task
Perform a **comprehensive audit** of this codebase and identify every issue, bug, risk, or improvement opportunity you can find. **DO NOT FIX ANY CODE. DO NOT WRITE PATCHES. DO NOT REWRITE FILES.** Only catalog and describe issues.

## Audit Dimensions

### 1. Security
- Review all API routes for missing auth checks, CSRF vulnerabilities, injection risks
- Review Supabase RLS policies in `supabase/schema.sql` for gaps
- Review file upload handling (intake attachments, entry photos)
- Review preview token generation and validation
- Review webhook signature verification (Stripe)
- Review session handling, token storage, and identity bridging (`/auth/complete`)
- Review CORS, CSP, and security headers in `next.config.ts`
- Check for hardcoded secrets, exposed env vars, or debug endpoints left open
- Review SQL injection risks in any raw queries
- Check for XSS vulnerabilities in rendered content (entries, custom apps)

### 2. Performance
- Review bundle size and code-splitting strategy
- Review image optimization (are images unoptimized? missing `next/image`?)
- Review font loading strategy
- Check for unnecessary re-renders, missing memoization
- Review data fetching patterns (are there N+1 queries?)
- Review caching headers and strategies
- Check for large dependencies or unnecessary imports
- Review dynamic imports and lazy loading effectiveness
- Check for blocking operations on critical paths

### 3. Accessibility (a11y)
- Review all forms for labels, focus management, error announcements
- Review color contrast ratios
- Check for missing alt text on images
- Review keyboard navigation flows
- Check ARIA usage (correct roles, states, live regions)
- Review modal/dialog accessibility
- Check for skip links and semantic HTML
- Review focus trapping in modals/drawers
- Test if the app is usable with a screen reader

### 4. UX / UI
- Review responsive design across breakpoints
- Review mobile touch targets and gesture handling
- Check for confusing navigation, dead ends, or broken flows
- Review error states, loading states, and empty states
- Check for inconsistent spacing, typography, or component patterns
- Review the iframe embedding of `/demo` on the landing page
- Check form validation UX (inline vs. on-submit, error messaging)
- Review the operator console `/ops` for usability
- Check if the 48-hour promise timer is clear and accurate

### 5. SEO
- Review meta tags, Open Graph, Twitter Cards on all pages
- Check for proper `<title>` and `<meta description>` on every route
- Review semantic HTML structure and heading hierarchy
- Check for client-side rendered critical content
- Review robots.txt and sitemap.xml (if they exist)
- Check canonical URLs
- Review structured data / JSON-LD

### 6. Code Quality & Maintainability
- Review TypeScript strictness and type safety
- Check for `any` types, missing return types, unsafe casts
- Review error handling (are errors swallowed? unhandled promises?)
- Check for console.log / debug statements in production code
- Review code duplication and DRY violations
- Check naming conventions and code organization
- Review test coverage (are there any tests?)
- Review documentation completeness
- Check for deprecated APIs or patterns (React 19 compatibility)

### 7. Database & Backend
- Review schema design (indexes, constraints, data types)
- Review triggers and functions in Supabase
- Check for race conditions in concurrent operations
- Review soft-delete implementation
- Check for missing database constraints (foreign keys, not-null)
- Review the `entry_no` allocation trigger for concurrency
- Check backup and disaster recovery considerations

### 8. DevOps & Infrastructure
- Review `next.config.ts` for production readiness
- Check environment variable requirements and fallbacks
- Review build configuration and output settings
- Check for missing `.env.example` values or undocumented requirements
- Review error monitoring / logging setup (is there any?)
- Check for health check endpoints

### 9. Business Logic & Data Integrity
- Review spreadsheet parsing edge cases (empty files, malformed data, huge files)
- Review schema inference accuracy and failure modes
- Check for data loss during tenant generation
- Review the handoff from intake → build → tenant activation
- Check if pricing configuration is consistent across frontend and backend
- Review email delivery reliability and fallback behavior

### 10. Legal & Compliance
- Review privacy policy and terms pages for completeness
- Check cookie consent / GDPR compliance
- Review data retention policies
- Check if the app handles PII appropriately

## Output Format

For each issue found, provide:

1. **Category** — Which audit dimension (Security, Performance, a11y, UX/UI, SEO, Code Quality, Database, DevOps, Business Logic, Legal)
2. **Severity** — `Critical` | `High` | `Medium` | `Low` | `Info`
3. **Location** — File path and line number(s) if applicable
4. **Description** — What the issue is and why it matters
5. **Impact** — What could go wrong if this is not addressed
6. **Suggested Priority** — Should this block launch, be fixed before scale, or is it a nice-to-have

Group issues by category. At the end, provide:
- A summary count by severity
- A "Top 10 Critical Issues" shortlist
- A "Quick Wins" list (high impact, low effort)

## Constraints
- **DO NOT modify any files.**
- **DO NOT provide code fixes, patches, or rewritten snippets.**
- **DO NOT create new files.**
- Only analyze, describe, and catalog.
- Be specific: cite file paths, function names, and line numbers where possible.
- If you're unsure about an issue, flag it as a question rather than a definitive finding.
