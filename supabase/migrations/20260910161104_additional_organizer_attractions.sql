-- Add another attraction to an existing organization without repeating company onboarding.

begin;

create or replace function public.ticketing_add_organizer_attraction(
  p_organization_id uuid,
  p_attraction_name text,
  p_attraction_slug text,
  p_attraction_description text,
  p_category_id uuid,
  p_address text,
  p_postal_code text,
  p_city text,
  p_latitude numeric,
  p_longitude numeric,
  p_images jsonb,
  p_sales_mode public.ticketing_sales_mode,
  p_product_name text,
  p_product_slug text,
  p_duration_minutes integer,
  p_ticket_name text,
  p_ticket_price numeric,
  p_weekdays smallint[],
  p_local_start_time time,
  p_local_end_time time,
  p_capacity integer,
  p_generate_until date
)
returns table (
  created_venue_id uuid,
  created_property_id uuid,
  created_product_id uuid,
  generated_session_count integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_user_id uuid := auth.uid();
  setup_result record;
  new_property_id uuid;
  normalized_images text[];
begin
  if actor_user_id is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if not exists (
    select 1
      from public.organization_memberships membership
      join public.organizations organization on organization.id = membership.organization_id
     where membership.organization_id = p_organization_id
       and membership.user_id = actor_user_id
       and membership.role in ('owner', 'admin', 'manager')
       and organization.status = 'active'
  ) then
    raise exception 'You cannot add attractions to this organization' using errcode = '42501';
  end if;

  if char_length(btrim(coalesce(p_attraction_name, ''))) not between 2 and 160
     or char_length(btrim(coalesce(p_attraction_description, ''))) not between 20 and 4000
     or char_length(btrim(coalesce(p_address, ''))) not between 3 and 240
     or char_length(btrim(coalesce(p_city, ''))) not between 2 and 120 then
    raise exception 'Valid attraction details are required' using errcode = '22023';
  end if;

  if p_latitude is null or p_latitude not between -90 and 90
     or p_longitude is null or p_longitude not between -180 and 180 then
    raise exception 'Valid map coordinates are required' using errcode = '22023';
  end if;

  if not exists (select 1 from public.categories where id = p_category_id) then
    raise exception 'Selected category does not exist' using errcode = '23503';
  end if;

  if char_length(btrim(coalesce(p_ticket_name, ''))) < 1 or p_ticket_price <= 0 then
    raise exception 'A valid first ticket is required' using errcode = '22023';
  end if;

  if jsonb_typeof(coalesce(p_images, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_images, '[]'::jsonb)) > 8 then
    raise exception 'Attraction images must be an array of up to 8 URLs' using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_array_elements_text(coalesce(p_images, '[]'::jsonb)) image(value)
     where char_length(image.value) > 2048 or image.value !~ '^https://res\.cloudinary\.com/'
  ) then
    raise exception 'Attraction image URLs must use the configured Cloudinary host' using errcode = '22023';
  end if;

  select coalesce(array_agg(image.value), array[]::text[])
    into normalized_images
    from jsonb_array_elements_text(coalesce(p_images, '[]'::jsonb)) image(value);

  select * into setup_result
    from public.ticketing_create_sales_setup(
      p_organization_id,
      null,
      null,
      p_attraction_name,
      p_attraction_slug,
      p_attraction_description,
      p_address,
      p_postal_code,
      p_city,
      p_sales_mode,
      p_product_name,
      p_product_slug,
      null,
      p_duration_minutes,
      jsonb_build_array(jsonb_build_object(
        'name', p_ticket_name,
        'price_amount', p_ticket_price,
        'capacity_units', 1,
        'max_quantity_per_order', 10
      )),
      p_weekdays,
      p_local_start_time,
      p_local_end_time,
      p_duration_minutes,
      p_capacity,
      60,
      p_generate_until
    );

  update public.venues
     set latitude = p_latitude, longitude = p_longitude
   where id = setup_result.created_venue_id;

  insert into public.properties (
    host_id, venue_id, title, description, property_type, category_id,
    address, city, country, latitude, longitude, price_per_night,
    max_guests, amenities, images, is_active
  ) values (
    actor_user_id, setup_result.created_venue_id, btrim(p_attraction_name), btrim(p_attraction_description),
    'attraction', p_category_id, btrim(p_address), btrim(p_city), 'Polska', p_latitude, p_longitude,
    p_ticket_price, p_capacity, array[]::text[], normalized_images, true
  ) returning id into new_property_id;

  perform public.ticketing_link_venue_property(setup_result.created_venue_id, new_property_id);

  update public.products
     set attraction_id = new_property_id
   where id = setup_result.created_product_id;

  return query select setup_result.created_venue_id, new_property_id,
    setup_result.created_product_id, setup_result.generated_session_count;
end;
$$;

revoke all on function public.ticketing_add_organizer_attraction(
  uuid, text, text, text, uuid, text, text, text, numeric, numeric, jsonb,
  public.ticketing_sales_mode, text, text, integer, text, numeric, smallint[], time, time, integer, date
) from public, anon, authenticated;

grant execute on function public.ticketing_add_organizer_attraction(
  uuid, text, text, text, uuid, text, text, text, numeric, numeric, jsonb,
  public.ticketing_sales_mode, text, text, integer, text, numeric, smallint[], time, time, integer, date
) to authenticated, service_role;

commit;