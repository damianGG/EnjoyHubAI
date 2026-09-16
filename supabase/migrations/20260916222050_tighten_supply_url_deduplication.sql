-- Tighten URL-based Supply identity matching for chains / multi-location operators.
-- A shared website or source URL is not enough when both records have known, different cities.

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
      and (
        v_city is null
        or lead.dedupe_city_key is null
        or lead.dedupe_city_key = v_city
      )
    order by
      (lead.dedupe_city_key = v_city) desc,
      (lead.dedupe_name_key = v_name) desc,
      lead.updated_at desc
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
        or (
          v_city is null
          and v_name is not null
          and lead.dedupe_name_key = v_name
        )
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
