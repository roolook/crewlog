alter table public.tenant_api_keys
  add column if not exists encrypted_key text,
  add column if not exists encryption_iv text,
  add column if not exists encryption_tag text;

comment on column public.tenant_api_keys.encrypted_key is
  'AES-GCM ciphertext for operator-authorized repeat reveal. Never returned through tenant RLS.';
