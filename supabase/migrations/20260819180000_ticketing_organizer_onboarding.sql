-- EnjoyHubAI organizer onboarding - stage 2C
--
-- Creates the first organization, public attraction, ticketing venue, product,
-- ticket prices and initial sessions in one transaction. The UI can therefore
-- present one simple business flow while the canonical models remain separate.

begin;

create or replace function public.ticketing_complete_organizer_onboarding(
  p_organization_name text,
  p_legal_name text,
  p_tax_id text,
  p_billing_email text,
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
  p_product_description text,
  p_duration_minutes integer,
  p_ticket_types jsonb,
  p_weekdays smallint[],
  p_local_start_time time,
  p_local_end_time time,
  p_slot_interval_minutes integer,
  p_capacity integer,
  p_sales_cutoff_minutes integer,
  p_generate_until date
)
returns table (
  created_organization_id uuid,
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
  starting_price numeric(12, 2);
begin
  if actor_user_id is null then
    raise exception 'Authentication is required to complete organizer onboarding'
      using errcode = '42501';
  end if;

  if char_length(btrim(coalesce(p_attraction_name, ''))) not between 2 and 160
     or char_length(btrim(coalesce(p_attraction_description, ''))) not between 20 and 4000
     or char_length(btrim(coalesce(p_address, ''))) not between 3 and 240
     or char_length(btrim(coalesce(p_city, ''))) not between 2 and 120 then
    raise exception 'Valid attraction details and address are required'
      using errcode = '22023';
  end if;

  if p_attraction_slug is null
     or p_attraction_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'A valid attraction slug is required'
      using errcode = '22023';
  end if;

  if p_latitude is null or p_latitude not between -90 and 90
     or p_longitude is null or p_longitude not between -180 and 180 then
    raise exception 'A valid attraction location is required'
      using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.categories category where category.id = p_category_id
  ) then
    raise exception 'Selected attraction category does not exist'
      using errcode = '23503';
  end if;

  if char_length(btrim(coalesce(p_billing_email, ''))) not between 3 and 254
     or position('@' in p_billing_email) <= 1 then
    raise exception 'A valid billing email is required'
      using errcode = '22023';
  end if;

  if p_tax_id is not null and p_tax_id !~ '^[0-9]{10}$' then
    raise exception 'Polish tax ID must contain 10 digits'
      using errcode = '22023';
  end if;

  if jsonb_typeof(coalesce(p_images, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_images, '[]'::jsonb)) > 8 then
    raise exception 'Attraction images must be an array of up to 8 URLs'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements_text(coalesce(p_images, '[]'::jsonb)) image(value)
    where char_length(image.value) > 2048
       or image.value !~ '^https://res\.cloudinary\.com/'
  ) then
    raise exception 'Attraction image URLs must use the configured Cloudinary host'
      using errcode = '22023';
  end if;

  select coalesce(array_agg(image.value), array[]::text[])
    into normalized_images
    from jsonb_array_elements_text(coalesce(p_images, '[]'::jsonb)) image(value);

  select *
    into setup_result
    from public.ticketing_create_sales_setup(
      null,
      null,
      p_organization_name,
      p_attraction_name,
      p_attraction_slug,
      p_attraction_description,
      p_address,
      p_postal_code,
      p_city,
      p_sales_mode,
      p_product_name,
      p_product_slug,
      p_product_description,
      p_duration_minutes,
      p_ticket_types,
      p_weekdays,
      p_local_start_time,
      p_local_end_time,
      p_slot_interval_minutes,
      p_capacity,
      p_sales_cutoff_minutes,
      p_generate_until
    );

  select min(ticket.price_amount)
    into starting_price
    from public.ticket_types ticket
   where ticket.product_id = setup_result.created_product_id
     and ticket.is_active;

  update public.organizations
     set legal_name = nullif(btrim(coalesce(p_legal_name, '')), ''),
         tax_id = nullif(btrim(coalesce(p_tax_id, '')), ''),
         billing_email = btrim(p_billing_email)
   where id = setup_result.created_organization_id;

  update public.venues
     set latitude = p_latitude,
         longitude = p_longitude
   where id = setup_result.created_venue_id;

  insert into public.properties (
    host_id,
    title,
    description,
    property_type,
    category_id,
    address,
    city,
    country,
    latitude,
    longitude,
    price_per_night,
    max_guests,
    amenities,
    images,
    is_active
  ) values (
    actor_user_id,
    btrim(p_attraction_name),
    btrim(p_attraction_description),
    'attraction',
    p_category_id,
    btrim(p_address),
    btrim(p_city),
    'Polska',
    p_latitude,
    p_longitude,
    starting_price,
    p_capacity,
    array[]::text[],
    normalized_images,
    true
  )
  returning id into new_property_id;

  perform public.ticketing_link_venue_property(
    setup_result.created_venue_id,
    new_property_id
  );

  -- Keep the legacy user profile coherent while authorization continues to use
  -- organization memberships as its canonical source of truth.
  update public.users
     set is_host = true,
         role = case when role = 'super_admin' then role else 'host' end,
         updated_at = now()
   where id = actor_user_id;

  return query select
    setup_result.created_organization_id,
    setup_result.created_venue_id,
    new_property_id,
    setup_result.created_product_id,
    setup_result.generated_session_count;
end;
$$;

revoke all on function public.ticketing_complete_organizer_onboarding(
  text, text, text, text, text, text, text, uuid, text, text, text,
  numeric, numeric, jsonb, public.ticketing_sales_mode, text, text, text,
  integer, jsonb, smallint[], time, time, integer, integer, integer, date
) from public, anon, authenticated;

grant execute on function public.ticketing_complete_organizer_onboarding(
  text, text, text, text, text, text, text, uuid, text, text, text,
  numeric, numeric, jsonb, public.ticketing_sales_mode, text, text, text,
  integer, jsonb, smallint[], time, time, integer, integer, integer, date
) to authenticated, service_role;

comment on function public.ticketing_complete_organizer_onboarding(
  text, text, text, text, text, text, text, uuid, text, text, text,
  numeric, numeric, jsonb, public.ticketing_sales_mode, text, text, text,
  integer, jsonb, smallint[], time, time, integer, integer, integer, date
) is 'Atomically creates the first organizer, public attraction, ticketing venue, offer, prices, schedule and initial sessions.';

commit;
