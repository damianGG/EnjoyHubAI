alter table public.venues
  add column if not exists contact_phone text,
  add column if not exists contact_email text,
  add column if not exists website_url text,
  add column if not exists external_booking_url text;

create unique index if not exists supply_leads_unique_attraction_idx
  on public.supply_leads (attraction_id)
  where attraction_id is not null;

create table if not exists public.profile_claim_requests (
  id uuid primary key default gen_random_uuid(),
  supply_lead_id uuid not null references public.supply_leads(id) on delete cascade,
  attraction_id uuid not null references public.properties(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  claimant_user_id uuid not null references auth.users(id) on delete cascade,
  claimant_email text,
  claimant_phone text,
  message text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  evidence jsonb not null default '{}'::jsonb check (jsonb_typeof(evidence) = 'object'),
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (supply_lead_id, claimant_user_id)
);

create index if not exists profile_claim_requests_status_idx
  on public.profile_claim_requests (status, submitted_at desc);
create index if not exists profile_claim_requests_attraction_idx
  on public.profile_claim_requests (attraction_id, status);

alter table public.profile_claim_requests enable row level security;
revoke all on public.profile_claim_requests from anon, authenticated;

create or replace function public.platform_supply_publish_lead(p_lead_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  actor_role public.platform_staff_role := public.platform_current_staff_role();
  lead_row public.supply_leads%rowtype;
  org_id uuid;
  venue_id uuid;
  attraction_id uuid;
  slug_base text;
  image_urls text[];
begin
  if actor_id is null or actor_role not in ('platform_superadmin','platform_support','platform_content') then
    raise exception 'Supply publish access required' using errcode = '42501';
  end if;

  select * into lead_row
  from public.supply_leads
  where id = p_lead_id
  for update;

  if not found then
    raise exception 'Supply lead not found' using errcode = 'P0002';
  end if;

  if lead_row.status = 'rejected' then
    raise exception 'Rejected lead cannot be published' using errcode = 'P0001';
  end if;

  if lead_row.status not in ('verified','owner_approved','published','partner') then
    raise exception 'Verify the lead before publishing' using errcode = 'P0001';
  end if;

  if nullif(btrim(coalesce(lead_row.city, '')), '') is null then
    raise exception 'City is required before publishing' using errcode = '22023';
  end if;

  if lead_row.attraction_id is not null then
    update public.properties
    set is_active = true,
        updated_at = now()
    where id = lead_row.attraction_id;

    update public.supply_leads
    set status = case when status = 'partner' then 'partner' else 'published' end,
        updated_by = actor_id,
        updated_at = now()
    where id = p_lead_id;

    return jsonb_build_object(
      'organizationId', lead_row.organization_id,
      'venueId', lead_row.venue_id,
      'attractionId', lead_row.attraction_id
    );
  end if;

  org_id := lead_row.organization_id;
  if org_id is null then
    insert into public.organizations (name, created_by)
    values (lead_row.name, actor_id)
    returning id into org_id;
  end if;

  venue_id := lead_row.venue_id;
  if venue_id is null then
    slug_base := trim(both '-' from regexp_replace(lower(lead_row.name), '[^a-z0-9]+', '-', 'g'));
    if slug_base = '' then slug_base := 'obiekt'; end if;

    insert into public.venues (
      organization_id, name, slug, description,
      address_line_1, postal_code, city, country_code,
      latitude, longitude, default_currency,
      status, created_by,
      contact_phone, contact_email, website_url, external_booking_url
    ) values (
      org_id,
      lead_row.name,
      slug_base || '-' || substr(gen_random_uuid()::text, 1, 8),
      coalesce(lead_row.public_description, lead_row.short_description),
      lead_row.address_line_1,
      lead_row.postal_code,
      lead_row.city,
      coalesce(lead_row.country_code, 'PL'),
      lead_row.latitude,
      lead_row.longitude,
      coalesce(lead_row.currency, 'PLN'),
      'draft',
      actor_id,
      lead_row.phone,
      lead_row.email,
      lead_row.website_url,
      lead_row.booking_url
    ) returning id into venue_id;
  else
    update public.venues
    set name = lead_row.name,
        description = coalesce(lead_row.public_description, lead_row.short_description, description),
        address_line_1 = lead_row.address_line_1,
        postal_code = lead_row.postal_code,
        city = lead_row.city,
        country_code = coalesce(lead_row.country_code, country_code),
        latitude = lead_row.latitude,
        longitude = lead_row.longitude,
        default_currency = coalesce(lead_row.currency, default_currency),
        contact_phone = lead_row.phone,
        contact_email = lead_row.email,
        website_url = lead_row.website_url,
        external_booking_url = lead_row.booking_url,
        updated_at = now()
    where id = venue_id;
  end if;

  select coalesce(array_agg(image.image_url order by image.is_primary desc, image.sort_order, image.created_at), array[]::text[])
  into image_urls
  from public.supply_lead_images image
  where image.lead_id = p_lead_id
    and image.rights_confirmed = true;

  insert into public.properties (
    host_id, title, description, property_type,
    address, city, country, latitude, longitude,
    price_per_night, max_guests, images, is_active,
    category_id, subcategory_id, venue_id
  ) values (
    null,
    lead_row.name,
    coalesce(lead_row.public_description, lead_row.short_description),
    'attraction',
    coalesce(lead_row.address_line_1, ''),
    lead_row.city,
    coalesce(lead_row.country_code, 'PL'),
    lead_row.latitude,
    lead_row.longitude,
    coalesce(lead_row.price_from, 0),
    case when lead_row.group_offer then 10 else 1 end,
    image_urls,
    true,
    lead_row.category_id,
    lead_row.subcategory_id,
    venue_id
  ) returning id into attraction_id;

  update public.venues
  set property_id = coalesce(property_id, attraction_id),
      updated_at = now()
  where id = venue_id;

  update public.supply_leads
  set organization_id = org_id,
      venue_id = venue_id,
      attraction_id = attraction_id,
      status = 'published',
      updated_by = actor_id,
      updated_at = now()
  where id = p_lead_id;

  insert into public.platform_admin_audit_log (
    actor_user_id, actor_role, organization_id, action, entity_type, entity_id, after_data
  ) values (
    actor_id, actor_role, org_id, 'supply.lead.published', 'attraction', attraction_id,
    jsonb_build_object('leadId', p_lead_id, 'venueId', venue_id, 'ownerAssigned', false)
  );

  return jsonb_build_object(
    'organizationId', org_id,
    'venueId', venue_id,
    'attractionId', attraction_id
  );
end;
$$;

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
      'organizationName', organization.name
    )
    from public.properties property
    join public.supply_leads lead on lead.attraction_id = property.id
    join public.organizations organization on organization.id = lead.organization_id
    where property.id = p_attraction_id
      and property.is_active = true
      and lead.status in ('published','partner')
    limit 1
  ), jsonb_build_object('attractionId', p_attraction_id, 'claimable', false));
$$;

create or replace function public.profile_claim_submit(
  p_attraction_id uuid,
  p_claimant_phone text default null,
  p_message text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  claimant_id uuid := auth.uid();
  claimant_email text;
  lead_row public.supply_leads%rowtype;
  existing_request public.profile_claim_requests%rowtype;
  request_id uuid;
begin
  if claimant_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into lead_row
  from public.supply_leads
  where attraction_id = p_attraction_id
    and status in ('published','partner')
  for update;

  if not found or lead_row.organization_id is null then
    raise exception 'Profile is not claimable' using errcode = 'P0002';
  end if;

  if lead_row.claim_status = 'claimed' then
    raise exception 'Profile has already been claimed' using errcode = 'P0001';
  end if;

  select email into claimant_email from auth.users where id = claimant_id;

  select * into existing_request
  from public.profile_claim_requests
  where supply_lead_id = lead_row.id and claimant_user_id = claimant_id
  for update;

  if found and existing_request.status = 'approved' then
    raise exception 'Claim was already approved' using errcode = 'P0001';
  end if;

  insert into public.profile_claim_requests (
    supply_lead_id, attraction_id, organization_id,
    claimant_user_id, claimant_email, claimant_phone, message,
    status, submitted_at, reviewed_by, reviewed_at, admin_note, updated_at
  ) values (
    lead_row.id, p_attraction_id, lead_row.organization_id,
    claimant_id, claimant_email,
    nullif(btrim(coalesce(p_claimant_phone, '')), ''),
    nullif(btrim(coalesce(p_message, '')), ''),
    'pending', now(), null, null, null, now()
  )
  on conflict (supply_lead_id, claimant_user_id) do update
    set claimant_email = excluded.claimant_email,
        claimant_phone = excluded.claimant_phone,
        message = excluded.message,
        status = 'pending',
        submitted_at = now(),
        reviewed_by = null,
        reviewed_at = null,
        admin_note = null,
        updated_at = now()
  returning id into request_id;

  update public.supply_leads
  set claim_status = 'claim_requested',
      updated_at = now()
  where id = lead_row.id;

  return request_id;
end;
$$;

create or replace function public.platform_supply_resolve_claim(
  p_request_id uuid,
  p_decision text,
  p_admin_note text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  actor_role public.platform_staff_role := public.platform_current_staff_role();
  request_row public.profile_claim_requests%rowtype;
  lead_row public.supply_leads%rowtype;
begin
  if actor_id is null or actor_role not in ('platform_superadmin','platform_support') then
    raise exception 'Platform support access required' using errcode = '42501';
  end if;

  if p_decision not in ('approved','rejected') then
    raise exception 'Decision must be approved or rejected' using errcode = '22023';
  end if;

  select * into request_row
  from public.profile_claim_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Claim request not found' using errcode = 'P0002';
  end if;

  select * into lead_row
  from public.supply_leads
  where id = request_row.supply_lead_id
  for update;

  if p_decision = 'approved' then
    if lead_row.claim_status = 'claimed' and request_row.status <> 'approved' then
      raise exception 'Profile has already been claimed' using errcode = 'P0001';
    end if;

    insert into public.organization_memberships (organization_id, user_id, role, invited_by)
    values (request_row.organization_id, request_row.claimant_user_id, 'owner', actor_id)
    on conflict (organization_id, user_id) do update
      set role = 'owner', invited_by = actor_id, updated_at = now();

    update public.profile_claim_requests
    set status = 'rejected',
        reviewed_by = actor_id,
        reviewed_at = now(),
        admin_note = coalesce(admin_note, 'Inny wniosek został zaakceptowany.'),
        updated_at = now()
    where supply_lead_id = request_row.supply_lead_id
      and id <> p_request_id
      and status = 'pending';

    update public.supply_leads
    set claim_status = 'claimed', updated_by = actor_id, updated_at = now()
    where id = request_row.supply_lead_id;
  else
    update public.supply_leads lead
    set claim_status = case
      when exists (
        select 1 from public.profile_claim_requests other
        where other.supply_lead_id = request_row.supply_lead_id
          and other.id <> p_request_id
          and other.status = 'pending'
      ) then 'claim_requested' else 'unclaimed' end,
      updated_by = actor_id,
      updated_at = now()
    where lead.id = request_row.supply_lead_id;
  end if;

  update public.profile_claim_requests
  set status = p_decision,
      reviewed_by = actor_id,
      reviewed_at = now(),
      admin_note = nullif(btrim(coalesce(p_admin_note, '')), ''),
      updated_at = now()
  where id = p_request_id;

  insert into public.platform_admin_audit_log (
    actor_user_id, actor_role, organization_id, action, entity_type, entity_id, after_data
  ) values (
    actor_id, actor_role, request_row.organization_id,
    case when p_decision = 'approved' then 'profile_claim.approved' else 'profile_claim.rejected' end,
    'profile_claim_request', p_request_id,
    jsonb_build_object('claimantUserId', request_row.claimant_user_id, 'leadId', request_row.supply_lead_id)
  );
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
      ), '[]'::jsonb),
      'claimRequests', coalesce((
        select jsonb_agg(
          to_jsonb(claim_request)
          || jsonb_build_object('claimantName', profile.full_name)
          order by claim_request.submitted_at desc
        )
        from public.profile_claim_requests claim_request
        left join public.users profile on profile.id = claim_request.claimant_user_id
        where claim_request.supply_lead_id = lead.id
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

revoke all on function public.platform_supply_publish_lead(uuid) from public, anon;
revoke all on function public.platform_supply_resolve_claim(uuid,text,text) from public, anon;
revoke all on function public.profile_claim_submit(uuid,text,text) from public, anon;
revoke all on function public.profile_claim_get(uuid) from public;

-- Anyone may ask whether a published attraction can be claimed; only safe public fields are returned.
grant execute on function public.profile_claim_get(uuid) to anon, authenticated;
grant execute on function public.profile_claim_submit(uuid,text,text) to authenticated;
grant execute on function public.platform_supply_publish_lead(uuid) to authenticated;
grant execute on function public.platform_supply_resolve_claim(uuid,text,text) to authenticated;
