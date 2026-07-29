-- Durable intake briefs, recoverable operator drafts, and truthful delivery
-- state for the rebuilt intake -> QA -> send workflow.

alter table public.intake_submissions
  add column if not exists company_name text,
  add column if not exists work_order text,
  add column if not exists intake_answers jsonb not null default '{}'::jsonb,
  add column if not exists build_draft jsonb not null default '{}'::jsonb,
  add column if not exists preview_sent_at timestamptz,
  add column if not exists delivery_error text;

create unique index if not exists intake_work_order_idx
  on public.intake_submissions (work_order)
  where work_order is not null;

alter table public.intake_requests
  add column if not exists prompt_id text,
  add column if not exists prompt_label text;

alter type public.request_status
  add value if not exists 'needs_clarification';

comment on column public.intake_submissions.intake_answers is
  'Customer answers keyed by stable prompt id. Each value includes the prompt '
  'label and answer so the build brief never loses its question context.';

comment on column public.intake_submissions.build_draft is
  'Operator-owned recoverable workbench state: source selection, schema, '
  'presentation, commercial tier, and QA checks.';

comment on column public.intake_submissions.delivery_error is
  'Most recent preview-delivery failure. Cleared only after a successful send.';
