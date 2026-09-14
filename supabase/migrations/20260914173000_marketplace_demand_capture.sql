create table if not exists public.attraction_demand_requests (
  id uuid primary key default gen_random_uuid(),
  attraction_id uuid not null references public.properties(id) on delete cascade,
  supply_lead_id uuid not null references public.supply_leads(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  email text not null,
  email_normalized text generated always as (lower(btrim(email))) stored,
  desired_date date not null,
  party_size integer not null default 1 check (party_size between 1 and 50),
  intent text not null default 'booking' check (intent in ('booking','notify')),
  status text not null default 'new' check (status in ('new','notified','converted','closed')),
  source text not null default 'profile' check (source in ('profile','waitlist','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists attraction_demand_requests_dedupe_idx
  on public.attraction_demand_requests (attraction_id, email_normalized, desired_date);
create index if not exists attraction_demand_requests_supply_idx
  on public.attraction_demand_requests (supply_lead_id, updated_at desc);
create index if not exists attraction_demand_requests_attraction_idx
  on public.attraction_demand_requests (attraction_id, updated_at desc);

alter table public.attraction_demand_requests enable row level security;
revoke all on public.attraction_demand_requests from public, anon, authenticated;

create or replace function public.marketplace_register_attraction_interest(
  p_attraction_id uuid,
  p_email text,
  p_desired_date date,
  p_party_size integer default 1
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  lead_row public.supply_leads%rowtype;
  normalized_email text := lower(btrim(coalesce(p_email, '')));
  request_id uuid;
begin
  if normalized_email = '' or length(normalized_email) > 320
     or normalized_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Valid email is required' using errcode = '22023';
  end if;

  if p_desired_date is null or p_desired_date < current_date or p_desired_date > current_date + 365 then
    raise exception 'Desired date must be within the next 365 days' using errcode = '22023';
  end if;

  if coalesce(p_party_size, 0) < 1 or p_party_size > 50 then
    raise exception 'Party size must be between 1 and 50' using errcode = '22023';
  end if;

  select lead.* into lead_row
  from public.supply_leads lead
  join public.properties property on property.id = lead.attraction_id
  where lead.attraction_id = p_attraction_id
    and property.is_active = true
    and lead.status in ('published','partner')
    and lead.claim_status <> 'claimed'
  limit 1;

  if not found then
    raise exception 'Attraction is not accepting marketplace interest' using errcode = 'P0002';
  end if;

  insert into public.attraction_demand_requests (
    attraction_id,
    supply_lead_id,
    user_id,
    email,
    desired_date,
    party_size,
    intent,
    source
  ) values (
    p_attraction_id,
    lead_row.id,
    auth.uid(),
    normalized_email,
    p_desired_date,
    p_party_size,
    'booking',
    'profile'
  )
  on conflict (attraction_id, email_normalized, desired_date) do update
    set party_size = excluded.party_size,
        user_id = coalesce(excluded.user_id, attraction_demand_requests.user_id),
        status = case when attraction_demand_requests.status = 'converted' then 'converted' else 'new' end,
        updated_at = now()
  returning id into request_id;

  return jsonb_build_object('requestId', request_id, 'accepted', true);
end;
$$;

revoke all on function public.marketplace_register_attraction_interest(uuid,text,date,integer) from public;
grant execute on function public.marketplace_register_attraction_interest(uuid,text,date,integer) to anon, authenticated;

create or replace function public.profile_claim_get(p_attraction_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((
    select jsonb_build_object(
      'attractionId', property.id,
      'name', property.title,
      'city', property.city,
      'claimable', lead.claim_status <> 'claimed',
      'claimStatus', lead.claim_status,
      'organizationName', organization.name,
      'demandPeople30d', coalesce(demand.people_30d, 0),
      'demandRequests30d', coalesce(demand.requests_30d, 0),
      'requestedSeats30d', coalesce(demand.seats_30d, 0),
      'estimatedValue30d', coalesce(demand.value_30d, 0),
      'demandTotal', coalesce(demand.total_requests, 0),
      'nextRequestedDate', demand.next_requested_date
    )
    from public.properties property
    join public.supply_leads lead on lead.attraction_id = property.id
    join public.organizations organization on organization.id = lead.organization_id
    left join lateral (
      select
        count(distinct request.email_normalized) filter (where request.updated_at >= now() - interval '30 days') as people_30d,
        count(*) filter (where request.updated_at >= now() - interval '30 days') as requests_30d,
        coalesce(sum(request.party_size) filter (where request.updated_at >= now() - interval '30 days'), 0) as seats_30d,
        coalesce(sum(request.party_size) filter (where request.updated_at >= now() - interval '30 days'), 0) * coalesce(lead.price_from, 0) as value_30d,
        count(*) as total_requests,
        min(request.desired_date) filter (where request.desired_date >= current_date and request.updated_at >= now() - interval '30 days') as next_requested_date
      from public.attraction_demand_requests request
      where request.supply_lead_id = lead.id
        and request.status <> 'closed'
    ) demand on true
    where property.id = p_attraction_id
      and property.is_active = true
      and lead.status in ('published','partner')
    limit 1
  ), jsonb_build_object('attractionId', p_attraction_id, 'claimable', false));
$$;

revoke all on function public.profile_claim_get(uuid) from public;
grant execute on function public.profile_claim_get(uuid) to anon, authenticated;

create or replace function public.platform_supply_list_leads_with_demand(
  p_search text default null,
  p_status text default null,
  p_region text default null,
  p_limit integer default 250
)
returns table (
  lead_id uuid,
  lead_name text,
  city text,
  region text,
  category_name text,
  subcategory_name text,
  score integer,
  priority_score integer,
  status text,
  claim_status text,
  booking_method text,
  price_from numeric,
  currency text,
  review_rating numeric,
  review_count integer,
  phone text,
  website_url text,
  attraction_id uuid,
  demand_people_30d bigint,
  demand_requests_30d bigint,
  demand_seats_30d bigint,
  estimated_demand_value_30d numeric,
  next_requested_date date,
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
  if staff_role not in ('platform_superadmin','platform_support','platform_content') then
    raise exception 'Supply access required' using errcode = '42501';
  end if;

  return query
  select
    lead.id,
    lead.name,
    lead.city,
    lead.region,
    category.name,
    subcategory.name,
    lead.score,
    least(100, lead.score + least(30, (coalesce(demand.people_30d, 0) * 6)::integer))::integer as priority_score,
    lead.status,
    lead.claim_status,
    lead.booking_method,
    lead.price_from,
    lead.currency,
    lead.review_rating,
    lead.review_count,
    lead.phone,
    lead.website_url,
    lead.attraction_id,
    coalesce(demand.people_30d, 0),
    coalesce(demand.requests_30d, 0),
    coalesce(demand.seats_30d, 0),
    coalesce(demand.seats_30d, 0) * coalesce(lead.price_from, 0) as estimated_demand_value_30d,
    demand.next_requested_date,
    lead.updated_at
  from public.supply_leads lead
  left join public.categories category on category.id = lead.category_id
  left join public.subcategories subcategory on subcategory.id = lead.subcategory_id
  left join lateral (
    select
      count(distinct request.email_normalized) filter (where request.updated_at >= now() - interval '30 days') as people_30d,
      count(*) filter (where request.updated_at >= now() - interval '30 days') as requests_30d,
      coalesce(sum(request.party_size) filter (where request.updated_at >= now() - interval '30 days'), 0)::bigint as seats_30d,
      min(request.desired_date) filter (where request.desired_date >= current_date and request.updated_at >= now() - interval '30 days') as next_requested_date
    from public.attraction_demand_requests request
    where request.supply_lead_id = lead.id
      and request.status <> 'closed'
  ) demand on true
  where (p_search is null or btrim(p_search) = ''
      or lead.name ilike '%' || btrim(p_search) || '%'
      or coalesce(lead.city, '') ilike '%' || btrim(p_search) || '%'
      or coalesce(lead.website_url, '') ilike '%' || btrim(p_search) || '%'
      or coalesce(lead.phone, '') ilike '%' || btrim(p_search) || '%')
    and (p_status is null or btrim(p_status) = '' or lead.status = p_status)
    and (p_region is null or btrim(p_region) = '' or lead.region = p_region)
  order by
    least(100, lead.score + least(30, (coalesce(demand.people_30d, 0) * 6)::integer)) desc,
    coalesce(demand.people_30d, 0) desc,
    lead.score desc,
    lead.updated_at desc
  limit least(greatest(coalesce(p_limit, 250), 1), 500);
end;
$$;

revoke all on function public.platform_supply_list_leads_with_demand(text,text,text,integer) from public, anon;
grant execute on function public.platform_supply_list_leads_with_demand(text,text,text,integer) to authenticated;
