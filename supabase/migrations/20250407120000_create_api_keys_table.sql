create table public.api_keys (
  id uuid not null default extensions.uuid_generate_v4 (),
  company_id uuid null,
  key_prefix text not null,
  key_hash text not null,
  key_salt text not null,
  name text not null,
  description text null,
  created_at timestamp with time zone null default now(),
  expires_at timestamp with time zone null,
  last_used_at timestamp with time zone null,
  scopes text[] null default '{}'::text[],
  usage_count integer null default 0,
  rate_limit integer null default 1000,
  active boolean null default true,
  constraint api_keys_pkey primary key (id),
  constraint api_keys_company_id_fkey foreign KEY (company_id) references companies (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_api_keys_key_hash on public.api_keys using btree (key_hash) TABLESPACE pg_default;

create index IF not exists idx_api_keys_company_id on public.api_keys using btree (company_id) TABLESPACE pg_default;

create index IF not exists idx_api_keys_key_prefix on public.api_keys using btree (key_prefix) TABLESPACE pg_default;