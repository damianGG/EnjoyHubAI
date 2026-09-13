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

create or replace function public.platform_supply_profile_completeness(p_lead_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  staff_role public.platform_staff_role := public.platform_current_staff_role();
  lead_row public.supply_leads%rowtype;
  base_done integer := 0;
  required_total integer := 0;
  required_done integer := 0;
  denominator integer;
begin
  if staff_role not in ('platform_superadmin','platform_support','platform_content') then
    raise exception 'Supply access required' using errcode = '42501';
  end if;

  select * into lead_row from public.supply_leads where id = p_lead_id;
  if not found then
    raise exception 'Supply lead not found' using errcode = 'P0002';
  end if;

  base_done :=
    (case when nullif(btrim(coalesce(lead_row.name, '')), '') is not null then 1 else 0 end) +
    (case when nullif(btrim(coalesce(lead_row.city, '')), '') is not null then 1 else 0 end) +
    (case when lead_row.category_id is not null then 1 else 0 end) +
    (case when lead_row.subcategory_id is not null then 1 else 0 end) +
    (case when coalesce(nullif(btrim(coalesce(lead_row.website_url, '')), ''), nullif(btrim(coalesce(lead_row.source_url, '')), '')) is not null then 1 else 0 end) +
    (case when coalesce(nullif(btrim(coalesce(lead_row.phone, '')), ''), nullif(btrim(coalesce(lead_row.email, '')), '')) is not null then 1 else 0 end) +
    (case when nullif(btrim(coalesce(lead_row.public_description, '')), '') is not null then 1 else 0 end) +
    (case when lead_row.price_from is not null then 1 else 0 end) +
    (case when lead_row.booking_method <> 'unknown' then 1 else 0 end) +
    (case when exists (select 1 from public.supply_lead_images image where image.lead_id = p_lead_id and image.rights_confirmed = true) then 1 else 0 end);

  select count(*) into required_total
  from public.supply_attribute_definitions definition
  where definition.active = true
    and definition.required_for_completeness = true
    and (
      (lead_row.subcategory_id is not null and definition.subcategory_id = lead_row.subcategory_id)
      or (definition.subcategory_id is null and lead_row.category_id is not null and definition.category_id = lead_row.category_id)
    );

  select count(*) into required_done
  from public.supply_attribute_values value
  join public.supply_attribute_definitions definition on definition.id = value.definition_id
  where value.lead_id = p_lead_id
    and value.verification_status in ('verified','owner_confirmed')
    and definition.required_for_completeness = true
    and definition.active = true
    and (
      (lead_row.subcategory_id is not null and definition.subcategory_id = lead_row.subcategory_id)
      or (definition.subcategory_id is null and lead_row.category_id is not null and definition.category_id = lead_row.category_id)
    );

  denominator := 10 + required_total;
  return least(100, greatest(0, round(100.0 * (base_done + required_done) / greatest(denominator, 1))::integer));
end;
$$;

create or replace function public.platform_supply_get_enrichment(p_lead_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  staff_role public.platform_staff_role := public.platform_current_staff_role();
  lead_row public.supply_leads%rowtype;
  result jsonb;
begin
  if staff_role not in ('platform_superadmin','platform_support','platform_content') then
    raise exception 'Supply access required' using errcode = '42501';
  end if;

  select * into lead_row from public.supply_leads where id = p_lead_id;
  if not found then
    raise exception 'Supply lead not found' using errcode = 'P0002';
  end if;

  select jsonb_build_object(
    'completeness', public.platform_supply_profile_completeness(p_lead_id),
    'definitions', coalesce((
      select jsonb_agg(to_jsonb(definition) order by definition.sort_order, definition.label)
      from public.supply_attribute_definitions definition
      where definition.active = true
        and (
          (lead_row.subcategory_id is not null and definition.subcategory_id = lead_row.subcategory_id)
          or (definition.subcategory_id is null and lead_row.category_id is not null and definition.category_id = lead_row.category_id)
        )
    ), '[]'::jsonb),
    'attributeValues', coalesce((
      select jsonb_agg(to_jsonb(value) || jsonb_build_object('key', definition.key, 'label', definition.label, 'valueType', definition.value_type) order by definition.sort_order, definition.label)
      from public.supply_attribute_values value
      join public.supply_attribute_definitions definition on definition.id = value.definition_id
      where value.lead_id = p_lead_id
    ), '[]'::jsonb),
    'externalSignals', coalesce((
      select jsonb_agg(to_jsonb(signal) order by signal.observed_at desc)
      from public.supply_external_signals signal
      where signal.lead_id = p_lead_id
    ), '[]'::jsonb),
    'runs', coalesce((
      select jsonb_agg(to_jsonb(run) - 'raw_response' order by run.started_at desc)
      from (select * from public.supply_enrichment_runs where lead_id = p_lead_id order by started_at desc limit 10) run
    ), '[]'::jsonb),
    'suggestions', coalesce((
      select jsonb_agg(to_jsonb(suggestion) order by suggestion.created_at desc)
      from public.supply_enrichment_suggestions suggestion
      where suggestion.lead_id = p_lead_id
      order by suggestion.created_at desc
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

create or replace function public.platform_supply_start_enrichment(p_lead_id uuid, p_model text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  actor_role public.platform_staff_role := public.platform_current_staff_role();
  run_id uuid;
begin
  if actor_id is null or actor_role not in ('platform_superadmin','platform_support','platform_content') then
    raise exception 'Supply access required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.supply_leads where id = p_lead_id) then
    raise exception 'Supply lead not found' using errcode = 'P0002';
  end if;

  insert into public.supply_enrichment_runs (lead_id, model, requested_by)
  values (p_lead_id, coalesce(nullif(btrim(p_model), ''), 'unknown'), actor_id)
  returning id into run_id;

  return run_id;
end;
$$;

create or replace function public.platform_supply_finish_enrichment(
  p_run_id uuid,
  p_result jsonb,
  p_raw_response jsonb default '{}'::jsonb
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  actor_role public.platform_staff_role := public.platform_current_staff_role();
  run_row public.supply_enrichment_runs%rowtype;
  fact jsonb;
  inserted_count integer := 0;
  source_list jsonb;
begin
  if actor_id is null or actor_role not in ('platform_superadmin','platform_support','platform_content') then
    raise exception 'Supply access required' using errcode = '42501';
  end if;

  select * into run_row from public.supply_enrichment_runs where id = p_run_id for update;
  if not found or run_row.requested_by <> actor_id then
    raise exception 'Enrichment run not found' using errcode = 'P0002';
  end if;
  if run_row.status <> 'running' then
    raise exception 'Enrichment run is already finished' using errcode = 'P0001';
  end if;

  if jsonb_typeof(coalesce(p_result->'facts', '[]'::jsonb)) <> 'array' then
    raise exception 'Invalid enrichment payload' using errcode = '22023';
  end if;

  for fact in select value from jsonb_array_elements(coalesce(p_result->'facts', '[]'::jsonb))
  loop
    if coalesce(fact->>'target_type', '') not in ('lead_field','attribute','external_signal') then
      continue;
    end if;
    if nullif(btrim(coalesce(fact->>'key', '')), '') is null then
      continue;
    end if;

    source_list := case
      when nullif(btrim(coalesce(fact->>'source_url', '')), '') is null then '[]'::jsonb
      else jsonb_build_array(fact->>'source_url')
    end;

    insert into public.supply_enrichment_suggestions (
      run_id, lead_id, target_type, target_key, proposed_value,
      confidence, source_urls, rationale
    ) values (
      p_run_id,
      run_row.lead_id,
      fact->>'target_type',
      lower(btrim(fact->>'key')),
      jsonb_build_object(
        'label', fact->>'label',
        'value', fact->'value',
        'numericValue', fact->'numeric_value',
        'booleanValue', fact->'boolean_value',
        'rating', fact->'rating',
        'reviewCount', fact->'review_count',
        'provider', fact->'provider',
        'valueType', fact->>'value_type',
        'sourceTitle', fact->>'source_title'
      ),
      least(100, greatest(0, coalesce((fact->>'confidence')::numeric, 0))),
      source_list,
      nullif(btrim(coalesce(fact->>'rationale', '')), '')
    );
    inserted_count := inserted_count + 1;
  end loop;

  update public.supply_enrichment_runs
  set status = 'completed',
      finished_at = now(),
      result_summary = nullif(btrim(coalesce(p_result->>'summary', '')), ''),
      raw_response = coalesce(p_raw_response, '{}'::jsonb)
  where id = p_run_id;

  insert into public.platform_admin_audit_log (
    actor_user_id, actor_role, action, entity_type, entity_id, after_data
  ) values (
    actor_id, actor_role, 'supply.enrichment.completed', 'supply_enrichment_run', p_run_id,
    jsonb_build_object('leadId', run_row.lead_id, 'suggestionCount', inserted_count, 'model', run_row.model)
  );

  return inserted_count;
end;
$$;

create or replace function public.platform_supply_fail_enrichment(p_run_id uuid, p_error text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  actor_role public.platform_staff_role := public.platform_current_staff_role();
begin
  if actor_id is null or actor_role not in ('platform_superadmin','platform_support','platform_content') then
    raise exception 'Supply access required' using errcode = '42501';
  end if;

  update public.supply_enrichment_runs
  set status = 'failed', finished_at = now(), error_message = left(coalesce(p_error, 'Unknown error'), 2000)
  where id = p_run_id and requested_by = actor_id and status = 'running';
end;
$$;

create or replace function public.platform_supply_resolve_enrichment_suggestion(
  p_suggestion_id uuid,
  p_decision text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  actor_role public.platform_staff_role := public.platform_current_staff_role();
  suggestion public.supply_enrichment_suggestions%rowtype;
  lead_row public.supply_leads%rowtype;
  definition_id uuid;
  source_url text;
  scalar_value jsonb;
  value_text text;
begin
  if actor_id is null or actor_role not in ('platform_superadmin','platform_support','platform_content') then
    raise exception 'Supply access required' using errcode = '42501';
  end if;
  if p_decision not in ('accepted','rejected') then
    raise exception 'Invalid decision' using errcode = '22023';
  end if;

  select * into suggestion from public.supply_enrichment_suggestions where id = p_suggestion_id for update;
  if not found then
    raise exception 'Suggestion not found' using errcode = 'P0002';
  end if;
  if suggestion.status <> 'pending' then
    raise exception 'Suggestion already reviewed' using errcode = 'P0001';
  end if;

  select * into lead_row from public.supply_leads where id = suggestion.lead_id for update;
  source_url := nullif(suggestion.source_urls->>0, '');
  value_text := suggestion.proposed_value->>'value';

  if p_decision = 'accepted' then
    if suggestion.target_type = 'lead_field' then
      if suggestion.target_key = 'website_url' then update public.supply_leads set website_url = value_text where id = suggestion.lead_id;
      elsif suggestion.target_key = 'booking_url' then update public.supply_leads set booking_url = value_text where id = suggestion.lead_id;
      elsif suggestion.target_key = 'phone' then update public.supply_leads set phone = value_text where id = suggestion.lead_id;
      elsif suggestion.target_key = 'email' then update public.supply_leads set email = value_text where id = suggestion.lead_id;
      elsif suggestion.target_key = 'address_line_1' then update public.supply_leads set address_line_1 = value_text where id = suggestion.lead_id;
      elsif suggestion.target_key = 'city' then update public.supply_leads set city = value_text where id = suggestion.lead_id;
      elsif suggestion.target_key = 'region' then update public.supply_leads set region = value_text where id = suggestion.lead_id;
      elsif suggestion.target_key = 'postal_code' then update public.supply_leads set postal_code = value_text where id = suggestion.lead_id;
      elsif suggestion.target_key = 'country_code' then update public.supply_leads set country_code = upper(value_text) where id = suggestion.lead_id;
      elsif suggestion.target_key = 'short_description' then update public.supply_leads set short_description = value_text where id = suggestion.lead_id;
      elsif suggestion.target_key = 'public_description' then update public.supply_leads set public_description = value_text where id = suggestion.lead_id;
      elsif suggestion.target_key = 'booking_method' and value_text in ('unknown','none','phone','whatsapp','messenger','form','email','own_booking') then update public.supply_leads set booking_method = value_text where id = suggestion.lead_id;
      elsif suggestion.target_key = 'price_from' and suggestion.proposed_value->>'numericValue' is not null then update public.supply_leads set price_from = (suggestion.proposed_value->>'numericValue')::numeric where id = suggestion.lead_id;
      elsif suggestion.target_key = 'has_paid_offer' and suggestion.proposed_value->>'booleanValue' is not null then update public.supply_leads set has_paid_offer = (suggestion.proposed_value->>'booleanValue')::boolean where id = suggestion.lead_id;
      elsif suggestion.target_key = 'requires_schedule' and suggestion.proposed_value->>'booleanValue' is not null then update public.supply_leads set requires_schedule = (suggestion.proposed_value->>'booleanValue')::boolean where id = suggestion.lead_id;
      elsif suggestion.target_key = 'group_offer' and suggestion.proposed_value->>'booleanValue' is not null then update public.supply_leads set group_offer = (suggestion.proposed_value->>'booleanValue')::boolean where id = suggestion.lead_id;
      elsif suggestion.target_key = 'indoor' and suggestion.proposed_value->>'booleanValue' is not null then update public.supply_leads set indoor = (suggestion.proposed_value->>'booleanValue')::boolean where id = suggestion.lead_id;
      elsif suggestion.target_key = 'year_round' and suggestion.proposed_value->>'booleanValue' is not null then update public.supply_leads set year_round = (suggestion.proposed_value->>'booleanValue')::boolean where id = suggestion.lead_id;
      else
        raise exception 'Unsupported or invalid lead field suggestion: %', suggestion.target_key using errcode = '22023';
      end if;

      update public.supply_leads
      set field_verification = jsonb_set(
            coalesce(field_verification, '{}'::jsonb),
            array[suggestion.target_key],
            jsonb_build_object('status','verified','source','ai','confidence',suggestion.confidence,'sourceUrl',source_url,'verifiedAt',now()),
            true
          ),
          updated_by = actor_id,
          updated_at = now()
      where id = suggestion.lead_id;

    elsif suggestion.target_type = 'attribute' then
      select definition.id into definition_id
      from public.supply_attribute_definitions definition
      where definition.active = true
        and definition.key = suggestion.target_key
        and (
          (lead_row.subcategory_id is not null and definition.subcategory_id = lead_row.subcategory_id)
          or (definition.subcategory_id is null and lead_row.category_id is not null and definition.category_id = lead_row.category_id)
        )
      order by case when definition.subcategory_id is not null then 0 else 1 end
      limit 1;

      if definition_id is null then
        insert into public.supply_attribute_definitions (
          category_id, subcategory_id, key, label, value_type, ai_prompt, created_by
        ) values (
          lead_row.category_id,
          lead_row.subcategory_id,
          suggestion.target_key,
          coalesce(nullif(suggestion.proposed_value->>'label',''), initcap(replace(suggestion.target_key, '_', ' '))),
          case when suggestion.proposed_value->>'valueType' in ('text','number','boolean','select','textarea') then suggestion.proposed_value->>'valueType' else 'text' end,
          'Pole zaproponowane przez enrichment AI i zaakceptowane przez administratora.',
          actor_id
        ) returning id into definition_id;
      end if;

      scalar_value := case
        when suggestion.proposed_value->>'valueType' = 'number' and suggestion.proposed_value->>'numericValue' is not null then to_jsonb((suggestion.proposed_value->>'numericValue')::numeric)
        when suggestion.proposed_value->>'valueType' = 'boolean' and suggestion.proposed_value->>'booleanValue' is not null then to_jsonb((suggestion.proposed_value->>'booleanValue')::boolean)
        else to_jsonb(coalesce(value_text, ''))
      end;

      insert into public.supply_attribute_values (
        lead_id, definition_id, value, verification_status, source_type, source_url, confidence, observed_at, updated_by
      ) values (
        suggestion.lead_id, definition_id, scalar_value, 'verified', 'ai', source_url, suggestion.confidence, now(), actor_id
      )
      on conflict (lead_id, definition_id) do update
      set value = excluded.value,
          verification_status = 'verified',
          source_type = 'ai',
          source_url = excluded.source_url,
          confidence = excluded.confidence,
          observed_at = now(),
          updated_by = actor_id,
          updated_at = now();

    elsif suggestion.target_type = 'external_signal' then
      insert into public.supply_external_signals (
        lead_id, provider, signal_type, rating, review_count, source_url, confidence, raw_metadata, observed_at
      ) values (
        suggestion.lead_id,
        lower(coalesce(nullif(suggestion.proposed_value->>'provider',''), suggestion.target_key)),
        'aggregate_rating',
        nullif(suggestion.proposed_value->>'rating','')::numeric,
        nullif(suggestion.proposed_value->>'reviewCount','')::integer,
        source_url,
        suggestion.confidence,
        jsonb_build_object('sourceTitle', suggestion.proposed_value->>'sourceTitle'),
        now()
      )
      on conflict (lead_id, provider, signal_type) do update
      set rating = excluded.rating,
          review_count = excluded.review_count,
          source_url = excluded.source_url,
          confidence = excluded.confidence,
          raw_metadata = excluded.raw_metadata,
          observed_at = now(),
          updated_at = now();
    end if;

    update public.supply_enrichment_suggestions
    set status = 'rejected', reviewed_by = actor_id, reviewed_at = now()
    where lead_id = suggestion.lead_id
      and id <> suggestion.id
      and status = 'pending'
      and target_type = suggestion.target_type
      and target_key = suggestion.target_key;
  end if;

  update public.supply_enrichment_suggestions
  set status = p_decision, reviewed_by = actor_id, reviewed_at = now()
  where id = p_suggestion_id;

  insert into public.platform_admin_audit_log (
    actor_user_id, actor_role, action, entity_type, entity_id, after_data
  ) values (
    actor_id, actor_role,
    case when p_decision = 'accepted' then 'supply.enrichment.accepted' else 'supply.enrichment.rejected' end,
    'supply_enrichment_suggestion', p_suggestion_id,
    jsonb_build_object('leadId', suggestion.lead_id, 'targetType', suggestion.target_type, 'targetKey', suggestion.target_key)
  );
end;
$$;

revoke all on function public.platform_supply_profile_completeness(uuid) from public, anon;
revoke all on function public.platform_supply_get_enrichment(uuid) from public, anon;
revoke all on function public.platform_supply_start_enrichment(uuid,text) from public, anon;
revoke all on function public.platform_supply_finish_enrichment(uuid,jsonb,jsonb) from public, anon;
revoke all on function public.platform_supply_fail_enrichment(uuid,text) from public, anon;
revoke all on function public.platform_supply_resolve_enrichment_suggestion(uuid,text) from public, anon;

grant execute on function public.platform_supply_profile_completeness(uuid) to authenticated;
grant execute on function public.platform_supply_get_enrichment(uuid) to authenticated;
grant execute on function public.platform_supply_start_enrichment(uuid,text) to authenticated;
grant execute on function public.platform_supply_finish_enrichment(uuid,jsonb,jsonb) to authenticated;
grant execute on function public.platform_supply_fail_enrichment(uuid,text) to authenticated;
grant execute on function public.platform_supply_resolve_enrichment_suggestion(uuid,text) to authenticated;
