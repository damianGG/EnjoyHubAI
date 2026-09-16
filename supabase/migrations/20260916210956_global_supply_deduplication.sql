-- Global Supply deduplication for manual entry and automated discovery.
-- Safe matching deliberately avoids domain-only and phone-only merges because chains may share them.

create or replace function public.supply_normalize_text(p_value text)
returns text
language sql
immutable
strict
parallel safe
set search_path = public, pg_temp
as $$
  select nullif(
    regexp_replace(
      translate(lower(btrim(p_value)), 'ąćęłńóśźż', 'acelnoszz'),
      '[^a-z0-9]+',
      '',
      'g'
    ),
    ''
  );
$$;

create or replace function public.supply_normalize_phone(p_value text)
returns text
language sql
immutable
strict
parallel safe
set search_path = public, pg_temp
as $$
  with normalized as (
    select regexp_replace(p_value, '[^0-9]', '', 'g') as digits
  )
  select case when length(digits) >= 9 then right(digits, 9) else null end
  from normalized;
$$;

create or replace function public.supply_normalize_url(p_value text)
returns text
language sql
immutable
strict
parallel safe
set search_path = public, pg_temp
as $$
  select nullif(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(lower(btrim(p_value)), '^https?://', '', 'i'),
          '^www\.',
          '',
          'i'
        ),
        '[?#].*$',
        ''
      ),
      '/+$',
      ''
    ),
    ''
  );
$$;

create or replace function public.supply_url_domain(p_value text)
returns text
language sql
immutable
strict
parallel safe
set search_path = public, pg_temp
as $$
  select nullif(split_part(public.supply_normalize_url(p_value), '/', 1), '');
$$;

alter table public.supply_leads
  add column if not exists dedupe_name_key text generated always as (public.supply_normalize_text(name)) stored,
  add column if not exists dedupe_city_key text generated always as (public.supply_normalize_text(city)) stored,
  add column if not exists dedupe_address_key text generated always as (public.supply_normalize_text(address_line_1)) stored,
  add column if not exists dedupe_phone_key text generated always as (public.supply_normalize_phone(phone)) stored,
  add column if not exists dedupe_website_url_key text generated always as (public.supply_normalize_url(website_url)) stored,
  add column if not exists dedupe_source_url_key text generated always as (public.supply_normalize_url(source_url)) stored,
  add column if not exists dedupe_domain_key text generated always as (public.supply_url_domain(website_url)) stored;

create index if not exists supply_leads_dedupe_name_city_idx
  on public.supply_leads (dedupe_name_key, dedupe_city_key)
  where dedupe_name_key is not null and dedupe_city_key is not null;
create index if not exists supply_leads_dedupe_phone_city_idx
  on public.supply_leads (dedupe_phone_key, dedupe_city_key)
  where dedupe_phone_key is not null and dedupe_city_key is not null;
create index if not exists supply_leads_dedupe_address_city_idx
  on public.supply_leads (dedupe_address_key, dedupe_city_key)
  where dedupe_address_key is not null and dedupe_city_key is not null;
create index if not exists supply_leads_dedupe_website_idx
  on public.supply_leads (dedupe_website_url_key)
  where dedupe_website_url_key is not null;
create index if not exists supply_leads_dedupe_source_idx
  on public.supply_leads (dedupe_source_url_key)
  where dedupe_source_url_key is not null;
create index if not exists supply_leads_dedupe_domain_name_city_idx
  on public.supply_leads (dedupe_domain_key, dedupe_name_key, dedupe_city_key)
  where dedupe_domain_key is not null and dedupe_name_key is not null and dedupe_city_key is not null;

create table if not exists public.supply_external_identities (
  source_provider text not null,
  source_external_id text not null,
  lead_id uuid not null references public.supply_leads(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (source_provider, source_external_id),
  constraint supply_external_identities_provider_nonempty check (btrim(source_provider) <> ''),
  constraint supply_external_identities_external_nonempty check (btrim(source_external_id) <> '')
);

create index if not exists supply_external_identities_lead_idx
  on public.supply_external_identities (lead_id);

alter table public.supply_external_identities enable row level security;
revoke all on public.supply_external_identities from anon, authenticated;

insert into public.supply_external_identities (source_provider, source_external_id, lead_id)
select lower(btrim(source.source_provider)), btrim(source.source_external_id), min(source.lead_id::text)::uuid
from public.supply_lead_sources source
where nullif(btrim(source.source_external_id), '') is not null
group by lower(btrim(source.source_provider)), btrim(source.source_external_id)
having count(distinct source.lead_id) = 1
on conflict (source_provider, source_external_id) do nothing;

create or replace function public.supply_dedupe_lock_key(
  p_data jsonb,
  p_source_provider text default null,
  p_external_id text default null
)
returns text
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_provider text := nullif(lower(btrim(p_source_provider)), '');
  v_external text := nullif(btrim(p_external_id), '');
  v_source_url text := public.supply_normalize_url(nullif(btrim(p_data->>'source_url'), ''));
  v_website_url text := public.supply_normalize_url(nullif(btrim(p_data->>'website_url'), ''));
  v_phone text := public.supply_normalize_phone(nullif(btrim(p_data->>'phone'), ''));
  v_name text := public.supply_normalize_text(nullif(btrim(p_data->>'name'), ''));
  v_city text := public.supply_normalize_text(nullif(btrim(p_data->>'city'), ''));
  v_address text := public.supply_normalize_text(nullif(btrim(p_data->>'address_line_1'), ''));
begin
  if v_provider is not null and v_external is not null then
    return 'external:' || v_provider || ':' || v_external;
  end if;
  if v_source_url is not null then return 'source:' || v_source_url; end if;
  if v_website_url is not null and v_city is not null then return 'website-city:' || v_website_url || ':' || v_city; end if;
  if v_phone is not null and v_city is not null then return 'phone-city:' || v_phone || ':' || v_city; end if;
  if v_address is not null and v_city is not null then return 'address-city:' || v_address || ':' || v_city; end if;
  if v_name is not null and v_city is not null then return 'name-city:' || v_name || ':' || v_city; end if;
  if v_name is not null then return 'name:' || v_name; end if;
  return null;
end;
$$;

create or replace function public.supply_find_duplicate_lead(
  p_data jsonb,
  p_source_provider text default null,
  p_external_id text default null,
  p_exclude_lead_id uuid default null
)
returns table (lead_id uuid, match_reason text, match_score integer)
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_provider text := nullif(lower(btrim(p_source_provider)), '');
  v_external text := nullif(btrim(p_external_id), '');
  v_name text := public.supply_normalize_text(nullif(btrim(p_data->>'name'), ''));
  v_city text := public.supply_normalize_text(nullif(btrim(p_data->>'city'), ''));
  v_address text := public.supply_normalize_text(nullif(btrim(p_data->>'address_line_1'), ''));
  v_phone text := public.supply_normalize_phone(nullif(btrim(p_data->>'phone'), ''));
  v_website text := public.supply_normalize_url(nullif(btrim(p_data->>'website_url'), ''));
  v_source text := public.supply_normalize_url(nullif(btrim(p_data->>'source_url'), ''));
  v_domain text := public.supply_url_domain(nullif(btrim(p_data->>'website_url'), ''));
  v_lat numeric := nullif(p_data->>'latitude', '')::numeric;
  v_lng numeric := nullif(p_data->>'longitude', '')::numeric;
begin
  if v_provider is not null and v_external is not null then
    return query
    select identity.lead_id, 'external_id'::text, 100
    from public.supply_external_identities identity
    where identity.source_provider = v_provider
      and identity.source_external_id = v_external
      and (p_exclude_lead_id is null or identity.lead_id <> p_exclude_lead_id)
    limit 1;
    if found then return; end if;
  end if;

  if v_source is not null then
    return query
    select lead.id, 'source_url'::text, 99
    from public.supply_leads lead
    where (p_exclude_lead_id is null or lead.id <> p_exclude_lead_id)
      and (lead.dedupe_source_url_key = v_source or lead.dedupe_website_url_key = v_source)
    order by lead.updated_at desc
    limit 1;
    if found then return; end if;
  end if;

  if v_website is not null then
    return query
    select lead.id, 'website_location'::text, 98
    from public.supply_leads lead
    where (p_exclude_lead_id is null or lead.id <> p_exclude_lead_id)
      and lead.dedupe_website_url_key = v_website
      and (
        (v_city is not null and lead.dedupe_city_key = v_city)
        or (v_name is not null and lead.dedupe_name_key = v_name)
      )
    order by
      (lead.dedupe_city_key = v_city) desc,
      (lead.dedupe_name_key = v_name) desc,
      lead.updated_at desc
    limit 1;
    if found then return; end if;
  end if;

  if v_phone is not null and v_city is not null then
    return query
    select lead.id, 'phone_city'::text, 97
    from public.supply_leads lead
    where (p_exclude_lead_id is null or lead.id <> p_exclude_lead_id)
      and lead.dedupe_phone_key = v_phone
      and lead.dedupe_city_key = v_city
    order by lead.updated_at desc
    limit 1;
    if found then return; end if;
  end if;

  if v_address is not null and v_city is not null then
    return query
    select lead.id, 'address_city'::text, 97
    from public.supply_leads lead
    where (p_exclude_lead_id is null or lead.id <> p_exclude_lead_id)
      and lead.dedupe_address_key = v_address
      and lead.dedupe_city_key = v_city
    order by lead.updated_at desc
    limit 1;
    if found then return; end if;
  end if;

  if v_name is not null and v_lat is not null and v_lng is not null then
    return query
    select lead.id, 'name_geo'::text, 96
    from public.supply_leads lead
    where (p_exclude_lead_id is null or lead.id <> p_exclude_lead_id)
      and lead.dedupe_name_key = v_name
      and lead.latitude is not null
      and lead.longitude is not null
      and abs(lead.latitude - v_lat) <= 0.002
      and abs(lead.longitude - v_lng) <= 0.003
    order by (abs(lead.latitude - v_lat) + abs(lead.longitude - v_lng)), lead.updated_at desc
    limit 1;
    if found then return; end if;
  end if;

  if v_name is not null and v_city is not null then
    return query
    select lead.id, 'name_city_consistent'::text, 95
    from public.supply_leads lead
    where (p_exclude_lead_id is null or lead.id <> p_exclude_lead_id)
      and lead.dedupe_name_key = v_name
      and lead.dedupe_city_key = v_city
      and (v_address is null or lead.dedupe_address_key is null or lead.dedupe_address_key = v_address)
      and (v_phone is null or lead.dedupe_phone_key is null or lead.dedupe_phone_key = v_phone)
      and (v_domain is null or lead.dedupe_domain_key is null or lead.dedupe_domain_key = v_domain)
      and (
        v_lat is null or v_lng is null or lead.latitude is null or lead.longitude is null
        or (abs(lead.latitude - v_lat) <= 0.01 and abs(lead.longitude - v_lng) <= 0.015)
      )
    order by
      (lead.dedupe_address_key = v_address) desc,
      (lead.dedupe_phone_key = v_phone) desc,
      (lead.dedupe_domain_key = v_domain) desc,
      lead.updated_at desc
    limit 1;
    if found then return; end if;
  end if;
end;
$$;

create or replace function public.supply_merge_lead_data(
  p_lead_id uuid,
  p_data jsonb,
  p_actor_id uuid
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  update public.supply_leads lead
  set
    source_url = coalesce(lead.source_url, nullif(btrim(p_data->>'source_url'), '')),
    website_url = coalesce(lead.website_url, nullif(btrim(p_data->>'website_url'), '')),
    booking_url = coalesce(lead.booking_url, nullif(btrim(p_data->>'booking_url'), '')),
    phone = coalesce(lead.phone, nullif(btrim(p_data->>'phone'), '')),
    email = coalesce(lead.email, nullif(btrim(p_data->>'email'), '')),
    address_line_1 = coalesce(lead.address_line_1, nullif(btrim(p_data->>'address_line_1'), '')),
    city = coalesce(lead.city, nullif(btrim(p_data->>'city'), '')),
    region = coalesce(lead.region, nullif(btrim(p_data->>'region'), '')),
    postal_code = coalesce(lead.postal_code, nullif(btrim(p_data->>'postal_code'), '')),
    latitude = coalesce(lead.latitude, nullif(p_data->>'latitude', '')::numeric),
    longitude = coalesce(lead.longitude, nullif(p_data->>'longitude', '')::numeric),
    category_id = coalesce(lead.category_id, nullif(p_data->>'category_id', '')::uuid),
    subcategory_id = coalesce(lead.subcategory_id, nullif(p_data->>'subcategory_id', '')::uuid),
    short_description = coalesce(lead.short_description, nullif(btrim(p_data->>'short_description'), '')),
    public_description = coalesce(lead.public_description, nullif(btrim(p_data->>'public_description'), '')),
    price_from = coalesce(lead.price_from, nullif(p_data->>'price_from', '')::numeric),
    review_rating = coalesce(lead.review_rating, nullif(p_data->>'review_rating', '')::numeric),
    review_count = coalesce(lead.review_count, nullif(p_data->>'review_count', '')::integer),
    booking_method = case
      when lead.booking_method = 'unknown' then coalesce(nullif(p_data->>'booking_method', ''), lead.booking_method)
      else lead.booking_method
    end,
    has_paid_offer = lead.has_paid_offer or coalesce(nullif(p_data->>'has_paid_offer', '')::boolean, false),
    requires_schedule = lead.requires_schedule or coalesce(nullif(p_data->>'requires_schedule', '')::boolean, false),
    group_offer = lead.group_offer or coalesce(nullif(p_data->>'group_offer', '')::boolean, false),
    indoor = lead.indoor or coalesce(nullif(p_data->>'indoor', '')::boolean, false),
    year_round = lead.year_round or coalesce(nullif(p_data->>'year_round', '')::boolean, false),
    source_payload = lead.source_payload || coalesce(p_data->'source_payload', '{}'::jsonb),
    field_verification = lead.field_verification || coalesce(p_data->'field_verification', '{}'::jsonb),
    updated_by = p_actor_id,
    updated_at = now()
  where lead.id = p_lead_id;
end;
$$;

create or replace function public.supply_resolve_or_create_lead(
  p_data jsonb,
  p_actor_id uuid,
  p_source_provider text default null,
  p_external_id text default null
)
returns table (lead_id uuid, created boolean, match_reason text, match_score integer)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_lock_key text;
  v_match record;
  v_created public.supply_leads%rowtype;
  v_provider text := nullif(lower(btrim(p_source_provider)), '');
  v_external text := nullif(btrim(p_external_id), '');
begin
  if nullif(btrim(p_data->>'name'), '') is null then
    raise exception 'Lead name is required' using errcode = '22023';
  end if;

  v_lock_key := public.supply_dedupe_lock_key(p_data, v_provider, v_external);
  if v_lock_key is not null then
    perform pg_advisory_xact_lock(hashtext(v_lock_key));
  end if;

  select * into v_match
  from public.supply_find_duplicate_lead(p_data, v_provider, v_external, null)
  limit 1;

  if v_match.lead_id is not null then
    perform public.supply_merge_lead_data(v_match.lead_id, p_data, p_actor_id);

    if v_provider is not null and v_external is not null then
      insert into public.supply_external_identities (source_provider, source_external_id, lead_id)
      values (v_provider, v_external, v_match.lead_id)
      on conflict (source_provider, source_external_id)
      do update set updated_at = now()
      where public.supply_external_identities.lead_id = excluded.lead_id;
    end if;

    return query select v_match.lead_id, false, v_match.match_reason, v_match.match_score;
    return;
  end if;

  insert into public.supply_leads (
    name, source_kind, source_url, website_url, booking_url, phone, email,
    address_line_1, city, region, postal_code, country_code, latitude, longitude,
    category_id, subcategory_id, short_description, public_description, price_from,
    currency, booking_method, has_paid_offer, requires_schedule, group_offer, indoor,
    year_round, review_rating, review_count, source_notes, admin_notes, source_payload,
    field_verification, created_by, updated_by
  ) values (
    btrim(p_data->>'name'),
    coalesce(nullif(p_data->>'source_kind',''), 'manual'),
    nullif(btrim(p_data->>'source_url'), ''),
    nullif(btrim(p_data->>'website_url'), ''),
    nullif(btrim(p_data->>'booking_url'), ''),
    nullif(btrim(p_data->>'phone'), ''),
    nullif(btrim(p_data->>'email'), ''),
    nullif(btrim(p_data->>'address_line_1'), ''),
    nullif(btrim(p_data->>'city'), ''),
    nullif(btrim(p_data->>'region'), ''),
    nullif(btrim(p_data->>'postal_code'), ''),
    coalesce(nullif(upper(btrim(p_data->>'country_code')), ''), 'PL'),
    nullif(p_data->>'latitude','')::numeric,
    nullif(p_data->>'longitude','')::numeric,
    nullif(p_data->>'category_id','')::uuid,
    nullif(p_data->>'subcategory_id','')::uuid,
    nullif(btrim(p_data->>'short_description'), ''),
    nullif(btrim(p_data->>'public_description'), ''),
    nullif(p_data->>'price_from','')::numeric,
    coalesce(nullif(upper(btrim(p_data->>'currency')), ''), 'PLN'),
    coalesce(nullif(p_data->>'booking_method',''), 'unknown'),
    coalesce((p_data->>'has_paid_offer')::boolean, false),
    coalesce((p_data->>'requires_schedule')::boolean, false),
    coalesce((p_data->>'group_offer')::boolean, false),
    coalesce((p_data->>'indoor')::boolean, false),
    coalesce((p_data->>'year_round')::boolean, false),
    nullif(p_data->>'review_rating','')::numeric,
    nullif(p_data->>'review_count','')::integer,
    nullif(btrim(p_data->>'source_notes'), ''),
    nullif(btrim(p_data->>'admin_notes'), ''),
    coalesce(p_data->'source_payload', '{}'::jsonb),
    coalesce(p_data->'field_verification', '{}'::jsonb),
    p_actor_id,
    p_actor_id
  ) returning * into v_created;

  if v_provider is not null and v_external is not null then
    insert into public.supply_external_identities (source_provider, source_external_id, lead_id)
    values (v_provider, v_external, v_created.id)
    on conflict (source_provider, source_external_id) do nothing;
  end if;

  return query select v_created.id, true, null::text, null::integer;
end;
$$;

create or replace function public.platform_supply_create_lead(p_data jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  actor_role public.platform_staff_role := public.platform_current_staff_role();
  resolved record;
  current_row jsonb;
  v_provider text := nullif(lower(btrim(coalesce(p_data->>'source_provider', p_data->>'source_kind'))), '');
  v_external text := nullif(btrim(p_data->>'external_id'), '');
begin
  if actor_id is null or actor_role is null or actor_role not in ('platform_superadmin','platform_support','platform_content') then
    raise exception 'Supply access required' using errcode = '42501';
  end if;

  select * into resolved
  from public.supply_resolve_or_create_lead(p_data, actor_id, v_provider, v_external)
  limit 1;

  select to_jsonb(lead) into current_row
  from public.supply_leads lead
  where lead.id = resolved.lead_id;

  insert into public.platform_admin_audit_log (
    actor_user_id, actor_role, action, entity_type, entity_id, after_data, metadata
  ) values (
    actor_id,
    actor_role,
    case when resolved.created then 'supply.lead.created' else 'supply.lead.duplicate_resolved' end,
    'supply_lead',
    resolved.lead_id,
    current_row,
    case when resolved.created then '{}'::jsonb else jsonb_build_object('match_reason', resolved.match_reason, 'match_score', resolved.match_score) end
  );

  return resolved.lead_id;
end;
$$;

create or replace function public.platform_supply_update_lead(
  p_lead_id uuid,
  p_data jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  actor_role public.platform_staff_role := public.platform_current_staff_role();
  before_row jsonb;
  after_row jsonb;
  duplicate_match record;
begin
  if actor_id is null or actor_role is null or actor_role not in ('platform_superadmin','platform_support','platform_content') then
    raise exception 'Supply access required' using errcode = '42501';
  end if;

  select to_jsonb(lead) into before_row
  from public.supply_leads lead
  where lead.id = p_lead_id
  for update;

  if before_row is null then
    raise exception 'Supply lead not found' using errcode = 'P0002';
  end if;

  update public.supply_leads lead
  set
    name = case when p_data ? 'name' then coalesce(nullif(btrim(p_data->>'name'), ''), lead.name) else lead.name end,
    source_kind = case when p_data ? 'source_kind' then coalesce(nullif(p_data->>'source_kind',''), lead.source_kind) else lead.source_kind end,
    source_url = case when p_data ? 'source_url' then nullif(btrim(p_data->>'source_url'), '') else lead.source_url end,
    website_url = case when p_data ? 'website_url' then nullif(btrim(p_data->>'website_url'), '') else lead.website_url end,
    booking_url = case when p_data ? 'booking_url' then nullif(btrim(p_data->>'booking_url'), '') else lead.booking_url end,
    phone = case when p_data ? 'phone' then nullif(btrim(p_data->>'phone'), '') else lead.phone end,
    email = case when p_data ? 'email' then nullif(btrim(p_data->>'email'), '') else lead.email end,
    address_line_1 = case when p_data ? 'address_line_1' then nullif(btrim(p_data->>'address_line_1'), '') else lead.address_line_1 end,
    city = case when p_data ? 'city' then nullif(btrim(p_data->>'city'), '') else lead.city end,
    region = case when p_data ? 'region' then nullif(btrim(p_data->>'region'), '') else lead.region end,
    postal_code = case when p_data ? 'postal_code' then nullif(btrim(p_data->>'postal_code'), '') else lead.postal_code end,
    country_code = case when p_data ? 'country_code' then coalesce(nullif(upper(btrim(p_data->>'country_code')), ''), lead.country_code) else lead.country_code end,
    latitude = case when p_data ? 'latitude' then nullif(p_data->>'latitude','')::numeric else lead.latitude end,
    longitude = case when p_data ? 'longitude' then nullif(p_data->>'longitude','')::numeric else lead.longitude end,
    category_id = case when p_data ? 'category_id' then nullif(p_data->>'category_id','')::uuid else lead.category_id end,
    subcategory_id = case when p_data ? 'subcategory_id' then nullif(p_data->>'subcategory_id','')::uuid else lead.subcategory_id end,
    short_description = case when p_data ? 'short_description' then nullif(btrim(p_data->>'short_description'), '') else lead.short_description end,
    public_description = case when p_data ? 'public_description' then nullif(btrim(p_data->>'public_description'), '') else lead.public_description end,
    price_from = case when p_data ? 'price_from' then nullif(p_data->>'price_from','')::numeric else lead.price_from end,
    currency = case when p_data ? 'currency' then coalesce(nullif(upper(btrim(p_data->>'currency')), ''), lead.currency) else lead.currency end,
    booking_method = case when p_data ? 'booking_method' then coalesce(nullif(p_data->>'booking_method',''), lead.booking_method) else lead.booking_method end,
    has_paid_offer = case when p_data ? 'has_paid_offer' then coalesce((p_data->>'has_paid_offer')::boolean, false) else lead.has_paid_offer end,
    requires_schedule = case when p_data ? 'requires_schedule' then coalesce((p_data->>'requires_schedule')::boolean, false) else lead.requires_schedule end,
    group_offer = case when p_data ? 'group_offer' then coalesce((p_data->>'group_offer')::boolean, false) else lead.group_offer end,
    indoor = case when p_data ? 'indoor' then coalesce((p_data->>'indoor')::boolean, false) else lead.indoor end,
    year_round = case when p_data ? 'year_round' then coalesce((p_data->>'year_round')::boolean, false) else lead.year_round end,
    review_rating = case when p_data ? 'review_rating' then nullif(p_data->>'review_rating','')::numeric else lead.review_rating end,
    review_count = case when p_data ? 'review_count' then nullif(p_data->>'review_count','')::integer else lead.review_count end,
    status = case when p_data ? 'status' then coalesce(nullif(p_data->>'status',''), lead.status) else lead.status end,
    claim_status = case when p_data ? 'claim_status' then coalesce(nullif(p_data->>'claim_status',''), lead.claim_status) else lead.claim_status end,
    source_notes = case when p_data ? 'source_notes' then nullif(btrim(p_data->>'source_notes'), '') else lead.source_notes end,
    admin_notes = case when p_data ? 'admin_notes' then nullif(btrim(p_data->>'admin_notes'), '') else lead.admin_notes end,
    source_payload = case when p_data ? 'source_payload' then coalesce(p_data->'source_payload', '{}'::jsonb) else lead.source_payload end,
    field_verification = case when p_data ? 'field_verification' then coalesce(p_data->'field_verification', '{}'::jsonb) else lead.field_verification end,
    verified_at = case
      when p_data ? 'status' and p_data->>'status' in ('verified','owner_approved','published','partner') then coalesce(lead.verified_at, now())
      else lead.verified_at
    end,
    last_contacted_at = case
      when p_data ? 'status' and p_data->>'status' in ('contacted','owner_approved','partner') then now()
      else lead.last_contacted_at
    end,
    updated_by = actor_id,
    updated_at = now()
  where lead.id = p_lead_id;

  select to_jsonb(lead) into after_row
  from public.supply_leads lead
  where lead.id = p_lead_id;

  select * into duplicate_match
  from public.supply_find_duplicate_lead(after_row, null, null, p_lead_id)
  limit 1;

  if duplicate_match.lead_id is not null then
    raise exception 'Supply lead would duplicate an existing lead'
      using errcode = '23505',
            detail = format('existing_lead_id=%s; reason=%s; score=%s', duplicate_match.lead_id, duplicate_match.match_reason, duplicate_match.match_score);
  end if;

  insert into public.platform_admin_audit_log (
    actor_user_id, actor_role, action, entity_type, entity_id, before_data, after_data
  ) values (
    actor_id, actor_role, 'supply.lead.updated', 'supply_lead', p_lead_id, before_row, after_row
  );
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
  candidate_data jsonb;
  candidate_name text;
  candidate_source_url text;
  candidate_provider text;
  candidate_external_id text;
  resolved record;
  lead_id_value uuid;
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
    candidate_provider := coalesce(nullif(lower(btrim(candidate->>'source_provider')), ''), 'web');
    candidate_external_id := nullif(btrim(candidate->>'external_id'), '');

    candidate_data := candidate || jsonb_build_object(
      'name', candidate_name,
      'source_kind', 'web',
      'source_url', candidate_source_url,
      'country_code', coalesce(nullif(upper(btrim(candidate->>'country_code')), ''), campaign_row.country_code),
      'category_id', campaign_row.category_id,
      'subcategory_id', campaign_row.subcategory_id,
      'source_notes', 'Discovery: ' || query_row.query_text,
      'source_payload', jsonb_build_object(
        'discovery_candidate', candidate,
        'campaign_id', campaign_row.id,
        'query_id', query_row.id
      )
    );

    select * into resolved
    from public.supply_resolve_or_create_lead(candidate_data, actor_id, candidate_provider, candidate_external_id)
    limit 1;

    lead_id_value := resolved.lead_id;

    if resolved.created then
      new_count := new_count + 1;
      insert into public.platform_admin_audit_log (
        actor_user_id, actor_role, action, entity_type, entity_id, after_data, metadata
      ) values (
        actor_id,
        actor_role,
        'supply.lead.discovered',
        'supply_lead',
        lead_id_value,
        jsonb_build_object('name', candidate_name, 'city', candidate->>'city', 'website_url', candidate->>'website_url'),
        jsonb_build_object('campaign_id', campaign_row.id, 'query_id', query_row.id, 'run_id', run_row.id)
      );
    else
      duplicate_count := duplicate_count + 1;
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
    select 1
    from public.supply_campaign_queries query
    where query.campaign_id = campaign_row.id
      and (
        query.status = 'pending'
        or query.status = 'running'
        or (query.status = 'failed' and query.attempts < 3)
      )
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

comment on table public.supply_external_identities is
  'Canonical provider/external-id ownership used by the global Supply deduplication resolver.';
comment on function public.supply_find_duplicate_lead(jsonb,text,text,uuid) is
  'Returns only strong duplicate matches. Domain-only and phone-only matches are intentionally excluded.';

revoke all on function public.supply_dedupe_lock_key(jsonb,text,text) from public, anon, authenticated;
revoke all on function public.supply_find_duplicate_lead(jsonb,text,text,uuid) from public, anon, authenticated;
revoke all on function public.supply_merge_lead_data(uuid,jsonb,uuid) from public, anon, authenticated;
revoke all on function public.supply_resolve_or_create_lead(jsonb,uuid,text,text) from public, anon, authenticated;
