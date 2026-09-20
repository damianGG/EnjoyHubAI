-- Avoid collisions between local identifiers and Supply columns.
-- Preserve existing authorization hardening and grants.
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
  v_venue_id uuid;
  v_attraction_id uuid;
  slug_base text;
  image_urls text[];
begin
  if actor_id is null or actor_role is null or actor_role not in ('platform_superadmin','platform_support','platform_content') then
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

  v_venue_id := lead_row.venue_id;
  if v_venue_id is null then
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
    ) returning id into v_venue_id;
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
    where id = v_venue_id;
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
    v_venue_id
  ) returning id into v_attraction_id;

  update public.venues
  set property_id = coalesce(property_id, v_attraction_id),
      updated_at = now()
  where id = v_venue_id;

  update public.supply_leads
  set organization_id = org_id,
      venue_id = v_venue_id,
      attraction_id = v_attraction_id,
      status = 'published',
      updated_by = actor_id,
      updated_at = now()
  where id = p_lead_id;

  insert into public.platform_admin_audit_log (
    actor_user_id, actor_role, organization_id, action, entity_type, entity_id, after_data
  ) values (
    actor_id, actor_role, org_id, 'supply.lead.published', 'attraction', v_attraction_id,
    jsonb_build_object('leadId', p_lead_id, 'venueId', v_venue_id, 'ownerAssigned', false)
  );

  return jsonb_build_object(
    'organizationId', org_id,
    'venueId', v_venue_id,
    'attractionId', v_attraction_id
  );
end;
$$;


revoke all on function public.platform_supply_publish_lead(uuid) from public, anon;
grant execute on function public.platform_supply_publish_lead(uuid) to authenticated;
