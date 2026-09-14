-- EnjoyHub Supply Discovery campaigns
-- Generic campaign engine; first seeded campaign: Paintball Polska.

create table if not exists public.supply_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  category_id uuid not null references public.categories(id) on delete restrict,
  subcategory_id uuid references public.subcategories(id) on delete set null,
  country_code text not null default 'PL' check (country_code ~ '^[A-Z]{2}$'),
  status text not null default 'draft' check (status in ('draft','ready','running','paused','completed','archived')),
  discovery_model text not null default 'gpt-5.6-luna',
  query_templates jsonb not null default '[]'::jsonb,
  locations jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supply_campaigns_query_templates_array check (jsonb_typeof(query_templates) = 'array'),
  constraint supply_campaigns_locations_array check (jsonb_typeof(locations) = 'array')
);

create table if not exists public.supply_campaign_queries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.supply_campaigns(id) on delete cascade,
  query_text text not null,
  location_name text,
  location_region text,
  status text not null default 'pending' check (status in ('pending','running','completed','failed','skipped')),
  attempts integer not null default 0 check (attempts >= 0),
  candidates_found integer not null default 0 check (candidates_found >= 0),
  new_leads integer not null default 0 check (new_leads >= 0),
  duplicates integer not null default 0 check (duplicates >= 0),
  last_error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, query_text)
);

create table if not exists public.supply_discovery_runs (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.supply_campaigns(id) on delete cascade,
  query_id uuid not null references public.supply_campaign_queries(id) on delete cascade,
  model text not null,
  status text not null default 'running' check (status in ('running','completed','failed')),
  response_id text,
  candidates_found integer not null default 0 check (candidates_found >= 0),
  new_leads integer not null default 0 check (new_leads >= 0),
  duplicates integer not null default 0 check (duplicates >= 0),
  raw_metadata jsonb not null default '{}'::jsonb,
  error_message text,
  created_by uuid references auth.users(id) on delete set null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint supply_discovery_runs_metadata_object check (jsonb_typeof(raw_metadata) = 'object')
);

create table if not exists public.supply_lead_sources (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.supply_leads(id) on delete cascade,
  campaign_id uuid references public.supply_campaigns(id) on delete set null,
  run_id uuid references public.supply_discovery_runs(id) on delete set null,
  query_id uuid references public.supply_campaign_queries(id) on delete set null,
  source_provider text not null default 'web',
  source_external_id text,
  query_text text,
  source_url text not null,
  source_title text,
  confidence integer check (confidence is null or confidence between 0 and 100),
  raw_payload jsonb not null default '{}'::jsonb,
  discovered_at timestamptz not null default now(),
  constraint supply_lead_sources_payload_object check (jsonb_typeof(raw_payload) = 'object')
);

create index if not exists supply_campaign_queries_next_idx
  on public.supply_campaign_queries (campaign_id, status, attempts, created_at);
create index if not exists supply_discovery_runs_campaign_idx
  on public.supply_discovery_runs (campaign_id, started_at desc);
create index if not exists supply_lead_sources_lead_idx
  on public.supply_lead_sources (lead_id, discovered_at desc);
create index if not exists supply_lead_sources_external_idx
  on public.supply_lead_sources (source_provider, source_external_id)
  where source_external_id is not null;

alter table public.supply_campaigns enable row level security;
alter table public.supply_campaign_queries enable row level security;
alter table public.supply_discovery_runs enable row level security;
alter table public.supply_lead_sources enable row level security;

revoke all on public.supply_campaigns from anon, authenticated;
revoke all on public.supply_campaign_queries from anon, authenticated;
revoke all on public.supply_discovery_runs from anon, authenticated;
revoke all on public.supply_lead_sources from anon, authenticated;

create or replace function public.platform_supply_list_campaigns()
returns table (
  campaign_id uuid,
  campaign_name text,
  campaign_slug text,
  category_name text,
  campaign_status text,
  queries_total bigint,
  queries_pending bigint,
  queries_completed bigint,
  queries_failed bigint,
  candidates_found bigint,
  new_leads bigint,
  duplicates bigint,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  staff_role public.platform_staff_role := public.platform_current_staff_role();
begin
  if staff_role is null or staff_role not in ('platform_superadmin','platform_support','platform_content') then
    raise exception 'Supply access required' using errcode = '42501';
  end if;

  return query
  select
    campaign.id,
    campaign.name,
    campaign.slug,
    category.name,
    campaign.status,
    count(query.id),
    count(query.id) filter (where query.status in ('pending','running')),
    count(query.id) filter (where query.status = 'completed'),
    count(query.id) filter (where query.status = 'failed'),
    coalesce(sum(query.candidates_found), 0),
    coalesce(sum(query.new_leads), 0),
    coalesce(sum(query.duplicates), 0),
    campaign.updated_at
  from public.supply_campaigns campaign
  join public.categories category on category.id = campaign.category_id
  left join public.supply_campaign_queries query on query.campaign_id = campaign.id
  group by campaign.id, category.name
  order by campaign.updated_at desc;
end;
$$;

create or replace function public.platform_supply_get_campaign(p_campaign_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  staff_role public.platform_staff_role := public.platform_current_staff_role();
  result jsonb;
begin
  if staff_role is null or staff_role not in ('platform_superadmin','platform_support','platform_content') then
    raise exception 'Supply access required' using errcode = '42501';
  end if;

  select to_jsonb(campaign)
    || jsonb_build_object(
      'category_name', category.name,
      'queries', coalesce((
        select jsonb_agg(to_jsonb(query) order by
          case query.status when 'running' then 0 when 'failed' then 1 when 'pending' then 2 else 3 end,
          query.created_at
        )
        from public.supply_campaign_queries query
        where query.campaign_id = campaign.id
      ), '[]'::jsonb),
      'stats', jsonb_build_object(
        'queries_total', (select count(*) from public.supply_campaign_queries query where query.campaign_id = campaign.id),
        'queries_pending', (select count(*) from public.supply_campaign_queries query where query.campaign_id = campaign.id and query.status in ('pending','running')),
        'queries_completed', (select count(*) from public.supply_campaign_queries query where query.campaign_id = campaign.id and query.status = 'completed'),
        'queries_failed', (select count(*) from public.supply_campaign_queries query where query.campaign_id = campaign.id and query.status = 'failed'),
        'candidates_found', (select coalesce(sum(query.candidates_found),0) from public.supply_campaign_queries query where query.campaign_id = campaign.id),
        'new_leads', (select coalesce(sum(query.new_leads),0) from public.supply_campaign_queries query where query.campaign_id = campaign.id),
        'duplicates', (select coalesce(sum(query.duplicates),0) from public.supply_campaign_queries query where query.campaign_id = campaign.id)
      )
    )
  into result
  from public.supply_campaigns campaign
  join public.categories category on category.id = campaign.category_id
  where campaign.id = p_campaign_id;

  if result is null then
    raise exception 'Supply campaign not found' using errcode = 'P0002';
  end if;

  return result;
end;
$$;

create or replace function public.platform_supply_start_discovery(p_campaign_id uuid)
returns table (
  run_id uuid,
  query_id uuid,
  query_text text,
  location_name text,
  category_name text,
  campaign_model text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  actor_role public.platform_staff_role := public.platform_current_staff_role();
  campaign_row public.supply_campaigns%rowtype;
  query_row public.supply_campaign_queries%rowtype;
  created_run_id uuid;
  category_label text;
begin
  if actor_id is null or actor_role is null or actor_role not in ('platform_superadmin','platform_support','platform_content') then
    raise exception 'Supply access required' using errcode = '42501';
  end if;

  select * into campaign_row
  from public.supply_campaigns campaign
  where campaign.id = p_campaign_id
    and campaign.status <> 'archived'
  for update;

  if not found then
    raise exception 'Supply campaign not found' using errcode = 'P0002';
  end if;

  select query.* into query_row
  from public.supply_campaign_queries query
  where query.campaign_id = p_campaign_id
    and (
      query.status = 'pending'
      or (query.status = 'failed' and query.attempts < 3)
    )
  order by case when query.status = 'pending' then 0 else 1 end, query.created_at
  for update skip locked
  limit 1;

  if not found then
    raise exception 'No pending discovery queries' using errcode = 'P0002';
  end if;

  update public.supply_campaign_queries
  set status = 'running',
      attempts = attempts + 1,
      started_at = now(),
      completed_at = null,
      last_error = null,
      updated_at = now()
  where id = query_row.id;

  update public.supply_campaigns
  set status = 'running', updated_at = now()
  where id = p_campaign_id;

  insert into public.supply_discovery_runs (
    campaign_id, query_id, model, status, created_by
  ) values (
    p_campaign_id, query_row.id, campaign_row.discovery_model, 'running', actor_id
  ) returning id into created_run_id;

  select category.name into category_label
  from public.categories category
  where category.id = campaign_row.category_id;

  return query
  select created_run_id, query_row.id, query_row.query_text, query_row.location_name, category_label, campaign_row.discovery_model;
end;
$$;

create or replace function public.platform_supply_finish_discovery(
  p_run_id uuid,
  p_candidates jsonb,
  p_raw_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  actor_role public.platform_staff_role := public.platform_current_staff_role();
  run_row public.supply_discovery_runs%rowtype;
  campaign_row public.supply_campaigns%rowtype;
  query_row public.supply_campaign_queries%rowtype;
  candidate jsonb;
  lead_id_value uuid;
  candidate_name text;
  candidate_website text;
  candidate_phone text;
  candidate_city text;
  candidate_region text;
  candidate_source_url text;
  candidate_domain text;
  candidate_phone_key text;
  candidate_name_key text;
  candidate_city_key text;
  candidate_provider text;
  candidate_external_id text;
  total_count integer := 0;
  new_count integer := 0;
  duplicate_count integer := 0;
begin
  if actor_id is null or actor_role is null or actor_role not in ('platform_superadmin','platform_support','platform_content') then
    raise exception 'Supply access required' using errcode = '42501';
  end if;

  if jsonb_typeof(coalesce(p_candidates, '[]'::jsonb)) <> 'array' then
    raise exception 'Discovery candidates must be an array' using errcode = '22023';
  end if;

  select * into run_row
  from public.supply_discovery_runs run
  where run.id = p_run_id
  for update;

  if not found or run_row.status <> 'running' then
    raise exception 'Discovery run is not active' using errcode = '22023';
  end if;

  select * into campaign_row from public.supply_campaigns where id = run_row.campaign_id;
  select * into query_row from public.supply_campaign_queries where id = run_row.query_id;

  for candidate in select value from jsonb_array_elements(coalesce(p_candidates, '[]'::jsonb))
  loop
    candidate_name := nullif(btrim(candidate->>'name'), '');
    candidate_source_url := nullif(btrim(candidate->>'source_url'), '');
    if candidate_name is null or candidate_source_url is null then
      continue;
    end if;

    total_count := total_count + 1;
    candidate_website := nullif(btrim(candidate->>'website_url'), '');
    candidate_phone := nullif(btrim(candidate->>'phone'), '');
    candidate_city := nullif(btrim(candidate->>'city'), '');
    candidate_region := nullif(btrim(candidate->>'region'), '');
    candidate_provider := coalesce(nullif(lower(btrim(candidate->>'source_provider')), ''), 'web');
    candidate_external_id := nullif(btrim(candidate->>'external_id'), '');

    candidate_domain := lower(split_part(regexp_replace(regexp_replace(coalesce(candidate_website, ''), '^https?://', '', 'i'), '^www\.', '', 'i'), '/', 1));
    candidate_phone_key := regexp_replace(coalesce(candidate_phone, ''), '[^0-9]', '', 'g');
    if length(candidate_phone_key) >= 9 then candidate_phone_key := right(candidate_phone_key, 9); end if;
    candidate_name_key := lower(regexp_replace(candidate_name, '[^[:alnum:]]', '', 'g'));
    candidate_city_key := lower(regexp_replace(coalesce(candidate_city, ''), '[^[:alnum:]]', '', 'g'));

    lead_id_value := null;

    if candidate_external_id is not null then
      select source.lead_id into lead_id_value
      from public.supply_lead_sources source
      where source.source_provider = candidate_provider
        and source.source_external_id = candidate_external_id
      order by source.discovered_at
      limit 1;
    end if;

    if lead_id_value is null and candidate_domain <> '' then
      select lead.id into lead_id_value
      from public.supply_leads lead
      where lower(split_part(regexp_replace(regexp_replace(coalesce(lead.website_url, ''), '^https?://', '', 'i'), '^www\.', '', 'i'), '/', 1)) = candidate_domain
      limit 1;
    end if;

    if lead_id_value is null and candidate_phone_key <> '' then
      select lead.id into lead_id_value
      from public.supply_leads lead
      where right(regexp_replace(coalesce(lead.phone, ''), '[^0-9]', '', 'g'), 9) = candidate_phone_key
      limit 1;
    end if;

    if lead_id_value is null and candidate_name_key <> '' and candidate_city_key <> '' then
      select lead.id into lead_id_value
      from public.supply_leads lead
      where lower(regexp_replace(lead.name, '[^[:alnum:]]', '', 'g')) = candidate_name_key
        and lower(regexp_replace(coalesce(lead.city, ''), '[^[:alnum:]]', '', 'g')) = candidate_city_key
      limit 1;
    end if;

    if lead_id_value is null then
      insert into public.supply_leads (
        name, source_kind, source_url, website_url, phone, email,
        address_line_1, city, region, postal_code, country_code, latitude, longitude,
        category_id, subcategory_id, source_notes, source_payload, created_by, updated_by
      ) values (
        candidate_name,
        'web',
        candidate_source_url,
        candidate_website,
        candidate_phone,
        nullif(btrim(candidate->>'email'), ''),
        nullif(btrim(candidate->>'address_line_1'), ''),
        candidate_city,
        candidate_region,
        nullif(btrim(candidate->>'postal_code'), ''),
        coalesce(nullif(upper(btrim(candidate->>'country_code')), ''), campaign_row.country_code),
        nullif(candidate->>'latitude', '')::numeric,
        nullif(candidate->>'longitude', '')::numeric,
        campaign_row.category_id,
        campaign_row.subcategory_id,
        'Discovery: ' || query_row.query_text,
        jsonb_build_object('discovery_candidate', candidate, 'campaign_id', campaign_row.id, 'query_id', query_row.id),
        actor_id,
        actor_id
      ) returning id into lead_id_value;

      new_count := new_count + 1;

      insert into public.platform_admin_audit_log (
        actor_user_id, actor_role, action, entity_type, entity_id, after_data, metadata
      ) values (
        actor_id, actor_role, 'supply.lead.discovered', 'supply_lead', lead_id_value,
        jsonb_build_object('name', candidate_name, 'city', candidate_city, 'website_url', candidate_website),
        jsonb_build_object('campaign_id', campaign_row.id, 'query_id', query_row.id, 'run_id', run_row.id)
      );
    else
      duplicate_count := duplicate_count + 1;

      update public.supply_leads lead
      set website_url = coalesce(lead.website_url, candidate_website),
          source_url = coalesce(lead.source_url, candidate_source_url),
          phone = coalesce(lead.phone, candidate_phone),
          email = coalesce(lead.email, nullif(btrim(candidate->>'email'), '')),
          address_line_1 = coalesce(lead.address_line_1, nullif(btrim(candidate->>'address_line_1'), '')),
          city = coalesce(lead.city, candidate_city),
          region = coalesce(lead.region, candidate_region),
          postal_code = coalesce(lead.postal_code, nullif(btrim(candidate->>'postal_code'), '')),
          latitude = coalesce(lead.latitude, nullif(candidate->>'latitude', '')::numeric),
          longitude = coalesce(lead.longitude, nullif(candidate->>'longitude', '')::numeric),
          category_id = coalesce(lead.category_id, campaign_row.category_id),
          updated_by = actor_id,
          updated_at = now()
      where lead.id = lead_id_value;
    end if;

    insert into public.supply_lead_sources (
      lead_id, campaign_id, run_id, query_id, source_provider, source_external_id,
      query_text, source_url, source_title, confidence, raw_payload
    )
    select
      lead_id_value,
      campaign_row.id,
      run_row.id,
      query_row.id,
      candidate_provider,
      candidate_external_id,
      query_row.query_text,
      candidate_source_url,
      nullif(btrim(candidate->>'source_title'), ''),
      nullif(candidate->>'confidence', '')::integer,
      candidate
    where not exists (
      select 1
      from public.supply_lead_sources source
      where source.lead_id = lead_id_value
        and source.query_id = query_row.id
        and source.source_url = candidate_source_url
    );
  end loop;

  update public.supply_discovery_runs
  set status = 'completed',
      response_id = nullif(p_raw_metadata->>'responseId', ''),
      candidates_found = total_count,
      new_leads = new_count,
      duplicates = duplicate_count,
      raw_metadata = coalesce(p_raw_metadata, '{}'::jsonb),
      completed_at = now()
  where id = p_run_id;

  update public.supply_campaign_queries
  set status = 'completed',
      candidates_found = total_count,
      new_leads = new_count,
      duplicates = duplicate_count,
      completed_at = now(),
      last_error = null,
      updated_at = now()
  where id = query_row.id;

  if not exists (
    select 1 from public.supply_campaign_queries query
    where query.campaign_id = campaign_row.id
      and (query.status = 'pending' or query.status = 'running' or (query.status = 'failed' and query.attempts < 3))
  ) then
    update public.supply_campaigns set status = 'completed', updated_at = now() where id = campaign_row.id;
  else
    update public.supply_campaigns set status = 'running', updated_at = now() where id = campaign_row.id;
  end if;

  return jsonb_build_object(
    'candidatesFound', total_count,
    'newLeads', new_count,
    'duplicates', duplicate_count,
    'query', query_row.query_text
  );
end;
$$;

create or replace function public.platform_supply_fail_discovery(p_run_id uuid, p_error text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  actor_role public.platform_staff_role := public.platform_current_staff_role();
  run_row public.supply_discovery_runs%rowtype;
begin
  if actor_id is null or actor_role is null or actor_role not in ('platform_superadmin','platform_support','platform_content') then
    raise exception 'Supply access required' using errcode = '42501';
  end if;

  select * into run_row from public.supply_discovery_runs where id = p_run_id for update;
  if not found then return; end if;

  update public.supply_discovery_runs
  set status = 'failed', error_message = left(coalesce(p_error, 'Unknown discovery error'), 4000), completed_at = now()
  where id = p_run_id;

  update public.supply_campaign_queries
  set status = 'failed', last_error = left(coalesce(p_error, 'Unknown discovery error'), 4000), completed_at = now(), updated_at = now()
  where id = run_row.query_id;

  update public.supply_campaigns set status = 'ready', updated_at = now() where id = run_row.campaign_id;
end;
$$;

revoke all on function public.platform_supply_list_campaigns() from public, anon;
revoke all on function public.platform_supply_get_campaign(uuid) from public, anon;
revoke all on function public.platform_supply_start_discovery(uuid) from public, anon;
revoke all on function public.platform_supply_finish_discovery(uuid,jsonb,jsonb) from public, anon;
revoke all on function public.platform_supply_fail_discovery(uuid,text) from public, anon;

grant execute on function public.platform_supply_list_campaigns() to authenticated;
grant execute on function public.platform_supply_get_campaign(uuid) to authenticated;
grant execute on function public.platform_supply_start_discovery(uuid) to authenticated;
grant execute on function public.platform_supply_finish_discovery(uuid,jsonb,jsonb) to authenticated;
grant execute on function public.platform_supply_fail_discovery(uuid,text) to authenticated;

-- Seed the first nationwide campaign without hard-coding the category UUID.
insert into public.supply_campaigns (
  name, slug, category_id, country_code, status, discovery_model, query_templates, locations
)
select
  'Paintball Polska',
  'paintball-polska',
  category.id,
  'PL',
  'ready',
  'gpt-5.6-luna',
  '["paintball {location}","paintball {location} i okolice"]'::jsonb,
  '["Warszawa","Kraków","Wrocław","Łódź","Poznań","Gdańsk","Gdynia","Szczecin","Lublin","Katowice","Rzeszów","Białystok","Bydgoszcz","Toruń","Kielce","Olsztyn","Opole","Zielona Góra","Radom","Częstochowa","Bielsko-Biała","Gliwice","Rybnik","Tarnów","Nowy Sącz","Koszalin"]'::jsonb
from public.categories category
where category.slug = 'paintball'
on conflict (slug) do update
set category_id = excluded.category_id,
    query_templates = excluded.query_templates,
    locations = excluded.locations,
    updated_at = now();

with campaign as (
  select id from public.supply_campaigns where slug = 'paintball-polska'
), locations(city, region) as (
  values
    ('Warszawa','Mazowieckie'),
    ('Kraków','Małopolskie'),
    ('Wrocław','Dolnośląskie'),
    ('Łódź','Łódzkie'),
    ('Poznań','Wielkopolskie'),
    ('Gdańsk','Pomorskie'),
    ('Gdynia','Pomorskie'),
    ('Szczecin','Zachodniopomorskie'),
    ('Lublin','Lubelskie'),
    ('Katowice','Śląskie'),
    ('Rzeszów','Podkarpackie'),
    ('Białystok','Podlaskie'),
    ('Bydgoszcz','Kujawsko-Pomorskie'),
    ('Toruń','Kujawsko-Pomorskie'),
    ('Kielce','Świętokrzyskie'),
    ('Olsztyn','Warmińsko-Mazurskie'),
    ('Opole','Opolskie'),
    ('Zielona Góra','Lubuskie'),
    ('Radom','Mazowieckie'),
    ('Częstochowa','Śląskie'),
    ('Bielsko-Biała','Śląskie'),
    ('Gliwice','Śląskie'),
    ('Rybnik','Śląskie'),
    ('Tarnów','Małopolskie'),
    ('Nowy Sącz','Małopolskie'),
    ('Koszalin','Zachodniopomorskie')
), templates(suffix) as (
  values (''), (' i okolice')
)
insert into public.supply_campaign_queries (campaign_id, query_text, location_name, location_region)
select campaign.id, 'paintball ' || locations.city || templates.suffix, locations.city, locations.region
from campaign
cross join locations
cross join templates
on conflict (campaign_id, query_text) do nothing;
