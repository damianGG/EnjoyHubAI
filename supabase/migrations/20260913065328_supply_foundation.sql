create table if not exists public.supply_leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  source_kind text not null default 'manual' check (source_kind in ('manual','web','map','social','referral','owner')),
  source_url text,
  website_url text,
  booking_url text,
  phone text,
  email text,
  address_line_1 text,
  city text,
  region text,
  postal_code text,
  country_code text not null default 'PL',
  latitude numeric(9,6),
  longitude numeric(9,6),
  category_id uuid references public.categories(id) on delete set null,
  subcategory_id uuid references public.subcategories(id) on delete set null,
  short_description text,
  public_description text,
  price_from numeric(12,2),
  currency text not null default 'PLN',
  booking_method text not null default 'unknown' check (booking_method in ('unknown','none','phone','whatsapp','messenger','form','email','own_booking')),
  has_paid_offer boolean not null default false,
  requires_schedule boolean not null default false,
  group_offer boolean not null default false,
  indoor boolean not null default false,
  year_round boolean not null default false,
  review_rating numeric(2,1) check (review_rating is null or (review_rating >= 0 and review_rating <= 5)),
  review_count integer check (review_count is null or review_count >= 0),
  score integer not null default 0 check (score between 0 and 100),
  status text not null default 'discovered' check (status in ('discovered','reviewing','verified','contacted','owner_approved','published','partner','rejected')),
  claim_status text not null default 'unclaimed' check (claim_status in ('unclaimed','claim_requested','claimed')),
  source_notes text,
  admin_notes text,
  source_payload jsonb not null default '{}'::jsonb,
  field_verification jsonb not null default '{}'::jsonb,
  organization_id uuid references public.organizations(id) on delete set null,
  venue_id uuid references public.venues(id) on delete set null,
  attraction_id uuid references public.properties(id) on delete set null,
  discovered_at timestamptz not null default now(),
  verified_at timestamptz,
  last_contacted_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supply_leads_source_payload_object check (jsonb_typeof(source_payload) = 'object'),
  constraint supply_leads_field_verification_object check (jsonb_typeof(field_verification) = 'object')
);

create table if not exists public.supply_lead_images (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.supply_leads(id) on delete cascade,
  image_url text not null,
  cloudinary_public_id text,
  source_type text not null default 'admin' check (source_type in ('admin','owner','licensed','public_reference')),
  source_url text,
  rights_confirmed boolean not null default false,
  is_primary boolean not null default false,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists supply_leads_status_score_idx on public.supply_leads (status, score desc, created_at desc);
create index if not exists supply_leads_region_city_idx on public.supply_leads (region, city);
create index if not exists supply_leads_category_idx on public.supply_leads (category_id, subcategory_id);
create index if not exists supply_leads_attraction_idx on public.supply_leads (attraction_id) where attraction_id is not null;
create index if not exists supply_lead_images_lead_idx on public.supply_lead_images (lead_id, sort_order, created_at);

alter table public.supply_leads enable row level security;
alter table public.supply_lead_images enable row level security;

revoke all on public.supply_leads from anon, authenticated;
revoke all on public.supply_lead_images from anon, authenticated;

create or replace function public.supply_refresh_score()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.score :=
      case when new.has_paid_offer then 20 else 0 end
    + case when coalesce(new.price_from, 0) >= 100 then 15 else 0 end
    + case when new.requires_schedule then 15 else 0 end
    + case when new.booking_method in ('none','phone','whatsapp','messenger','form','email') then 15 else 0 end
    + case when coalesce(new.review_count, 0) >= 100 then 10 else 0 end
    + case when coalesce(new.review_rating, 0) >= 4.5 then 5 else 0 end
    + case when new.group_offer then 10 else 0 end
    + case when new.year_round then 5 else 0 end;
  return new;
end;
$$;

drop trigger if exists supply_leads_refresh_score on public.supply_leads;
create trigger supply_leads_refresh_score
before insert or update of has_paid_offer, price_from, requires_schedule, booking_method, review_count, review_rating, group_offer, year_round
on public.supply_leads
for each row execute function public.supply_refresh_score();

create or replace function public.platform_supply_list_leads(
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
    lead.updated_at
  from public.supply_leads lead
  left join public.categories category on category.id = lead.category_id
  left join public.subcategories subcategory on subcategory.id = lead.subcategory_id
  where (p_search is null or btrim(p_search) = ''
      or lead.name ilike '%' || btrim(p_search) || '%'
      or coalesce(lead.city, '') ilike '%' || btrim(p_search) || '%'
      or coalesce(lead.website_url, '') ilike '%' || btrim(p_search) || '%'
      or coalesce(lead.phone, '') ilike '%' || btrim(p_search) || '%')
    and (p_status is null or btrim(p_status) = '' or lead.status = p_status)
    and (p_region is null or btrim(p_region) = '' or lead.region = p_region)
  order by lead.score desc, lead.updated_at desc
  limit least(greatest(coalesce(p_limit, 250), 1), 500);
end;
$$;

create or replace function public.platform_supply_get_lead(p_lead_id uuid)
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
  if staff_role not in ('platform_superadmin','platform_support','platform_content') then
    raise exception 'Supply access required' using errcode = '42501';
  end if;

  select to_jsonb(lead)
    || jsonb_build_object(
      'categoryName', category.name,
      'subcategoryName', subcategory.name,
      'images', coalesce((
        select jsonb_agg(to_jsonb(image) order by image.is_primary desc, image.sort_order, image.created_at)
        from public.supply_lead_images image
        where image.lead_id = lead.id
      ), '[]'::jsonb)
    )
  into result
  from public.supply_leads lead
  left join public.categories category on category.id = lead.category_id
  left join public.subcategories subcategory on subcategory.id = lead.subcategory_id
  where lead.id = p_lead_id;

  if result is null then
    raise exception 'Supply lead not found' using errcode = 'P0002';
  end if;

  return result;
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
  created_row public.supply_leads%rowtype;
begin
  if actor_id is null or actor_role not in ('platform_superadmin','platform_support','platform_content') then
    raise exception 'Supply access required' using errcode = '42501';
  end if;

  if nullif(btrim(p_data->>'name'), '') is null then
    raise exception 'Lead name is required' using errcode = '22023';
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
    actor_id,
    actor_id
  ) returning * into created_row;

  insert into public.platform_admin_audit_log (
    actor_user_id, actor_role, action, entity_type, entity_id, after_data
  ) values (
    actor_id, actor_role, 'supply.lead.created', 'supply_lead', created_row.id, to_jsonb(created_row)
  );

  return created_row.id;
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
begin
  if actor_id is null or actor_role not in ('platform_superadmin','platform_support','platform_content') then
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

  select to_jsonb(lead) into after_row from public.supply_leads lead where lead.id = p_lead_id;

  insert into public.platform_admin_audit_log (
    actor_user_id, actor_role, action, entity_type, entity_id, before_data, after_data
  ) values (
    actor_id, actor_role, 'supply.lead.updated', 'supply_lead', p_lead_id, before_row, after_row
  );
end;
$$;

revoke all on function public.platform_supply_list_leads(text,text,text,integer) from public;
revoke all on function public.platform_supply_get_lead(uuid) from public;
revoke all on function public.platform_supply_create_lead(jsonb) from public;
revoke all on function public.platform_supply_update_lead(uuid,jsonb) from public;

grant execute on function public.platform_supply_list_leads(text,text,text,integer) to authenticated;
grant execute on function public.platform_supply_get_lead(uuid) to authenticated;
grant execute on function public.platform_supply_create_lead(jsonb) to authenticated;
grant execute on function public.platform_supply_update_lead(uuid,jsonb) to authenticated;
