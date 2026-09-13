create table if not exists public.supply_attribute_definitions (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id) on delete cascade,
  subcategory_id uuid references public.subcategories(id) on delete cascade,
  legacy_field_id uuid references public.category_fields(id) on delete set null,
  key text not null check (key ~ '^[a-z0-9_]{2,80}$'),
  label text not null,
  value_type text not null default 'text' check (value_type in ('text','number','boolean','select','textarea')),
  ai_prompt text,
  required_for_completeness boolean not null default false,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (category_id is not null or subcategory_id is not null or legacy_field_id is not null)
);

create unique index if not exists supply_attribute_definition_subcategory_key_idx
  on public.supply_attribute_definitions (subcategory_id, key)
  where subcategory_id is not null;
create unique index if not exists supply_attribute_definition_category_key_idx
  on public.supply_attribute_definitions (category_id, key)
  where category_id is not null and subcategory_id is null;
create index if not exists supply_attribute_definitions_lookup_idx
  on public.supply_attribute_definitions (category_id, subcategory_id, active, sort_order);

create table if not exists public.supply_attribute_values (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.supply_leads(id) on delete cascade,
  definition_id uuid not null references public.supply_attribute_definitions(id) on delete cascade,
  value jsonb not null,
  verification_status text not null default 'suggested' check (verification_status in ('suggested','verified','owner_confirmed')),
  source_type text not null default 'admin' check (source_type in ('admin','ai','owner','import')),
  source_url text,
  confidence numeric(5,2) check (confidence is null or (confidence >= 0 and confidence <= 100)),
  observed_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lead_id, definition_id)
);
create index if not exists supply_attribute_values_lead_idx
  on public.supply_attribute_values (lead_id, verification_status);

create table if not exists public.supply_external_signals (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.supply_leads(id) on delete cascade,
  provider text not null,
  signal_type text not null default 'aggregate_rating',
  external_id text,
  rating numeric(3,2) check (rating is null or (rating >= 0 and rating <= 5)),
  review_count integer check (review_count is null or review_count >= 0),
  source_url text,
  confidence numeric(5,2) check (confidence is null or (confidence >= 0 and confidence <= 100)),
  raw_metadata jsonb not null default '{}'::jsonb,
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lead_id, provider, signal_type)
);
create index if not exists supply_external_signals_lead_idx
  on public.supply_external_signals (lead_id, observed_at desc);

create table if not exists public.supply_enrichment_runs (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.supply_leads(id) on delete cascade,
  status text not null default 'running' check (status in ('running','completed','failed')),
  provider text not null default 'openai',
  model text not null,
  prompt_version text not null default 'supply-enrichment-v1',
  requested_by uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  error_message text,
  result_summary text,
  raw_response jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists supply_enrichment_runs_lead_idx
  on public.supply_enrichment_runs (lead_id, started_at desc);

create table if not exists public.supply_enrichment_suggestions (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.supply_enrichment_runs(id) on delete cascade,
  lead_id uuid not null references public.supply_leads(id) on delete cascade,
  target_type text not null check (target_type in ('lead_field','attribute','external_signal')),
  target_key text not null,
  proposed_value jsonb not null,
  confidence numeric(5,2) not null default 0 check (confidence >= 0 and confidence <= 100),
  source_urls jsonb not null default '[]'::jsonb check (jsonb_typeof(source_urls) = 'array'),
  rationale text,
  status text not null default 'pending' check (status in ('pending','accepted','rejected')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists supply_enrichment_suggestions_lead_idx
  on public.supply_enrichment_suggestions (lead_id, status, created_at desc);

alter table public.supply_attribute_definitions enable row level security;
alter table public.supply_attribute_values enable row level security;
alter table public.supply_external_signals enable row level security;
alter table public.supply_enrichment_runs enable row level security;
alter table public.supply_enrichment_suggestions enable row level security;

revoke all on public.supply_attribute_definitions from anon, authenticated;
revoke all on public.supply_attribute_values from anon, authenticated;
revoke all on public.supply_external_signals from anon, authenticated;
revoke all on public.supply_enrichment_runs from anon, authenticated;
revoke all on public.supply_enrichment_suggestions from anon, authenticated;
