-- EnjoyHub organizer availability + offer model.
--
-- Point 7: recurring schedules are the source of truth; concrete sessions are a
-- rolling materialization only. Organizers can add per-date exceptions safely.
-- Point 8: an attraction contains sellable offers (products), and each offer
-- contains ticket variants (ticket_types). Additional-attraction onboarding v2
-- accepts explicit offer and ticket descriptions instead of synthesizing them.

begin;

comment on table public.product_schedules is
  'Recurring weekly availability rules for an offer. Concrete sessions are generated automatically from these rules.';
comment on table public.product_schedule_exceptions is
  'Per-date overrides for a recurring offer schedule, such as closure, special hours or special capacity.';
comment on table public.products is
  'Sellable offer attached to an attraction/venue, e.g. 60-minute entry. An attraction may have multiple offers.';
comment on table public.ticket_types is
  'Price/eligibility variants inside one offer, e.g. normal, reduced or family. Variants consume offer capacity units.';

create or replace function public.ticketing_set_schedule_exception(
  p_schedule_id uuid,
  p_local_date date,
  p_mode text,
  p_local_start_time time default null,
  p_local_end_time time default null,
  p_capacity integer default null,
  p_reason text default null
)
returns table (
  exception_id uuid,
  regenerated_session_count integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_user_id uuid := auth.uid();
  schedule_context record;
  new_exception_id uuid;
  generated_count integer := 0;
begin
  if actor_user_id is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if p_local_date is null or p_local_date < current_date or p_local_date > current_date + 366 then
    raise exception 'Availability exception date must be within the next 366 days' using errcode = '22023';
  end if;

  select
    schedule.product_id,
    product.duration_minutes,
    venue.timezone,
    venue.organization_id
    into schedule_context
    from public.product_schedules schedule
    join public.products product on product.id = schedule.product_id
    join public.venues venue on venue.id = product.venue_id
   where schedule.id = p_schedule_id
     and schedule.is_active;

  if not found then
    raise exception 'Schedule does not exist or is inactive' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
      from public.organization_memberships membership
     where membership.organization_id = schedule_context.organization_id
       and membership.user_id = actor_user_id
       and membership.role in ('owner', 'admin', 'manager')
  ) then
    raise exception 'You cannot manage this schedule' using errcode = '42501';
  end if;

  if p_mode not in ('closed', 'override') then
    raise exception 'Exception mode must be closed or override' using errcode = '22023';
  end if;

  if p_mode = 'override' then
    if p_capacity is not null and p_capacity < 1 then
      raise exception 'Capacity must be greater than zero' using errcode = '22023';
    end if;

    if (p_local_start_time is null) <> (p_local_end_time is null) then
      raise exception 'Special opening hours require both start and end time' using errcode = '22023';
    end if;

    if p_local_start_time is null and p_capacity is null then
      raise exception 'Override must change hours or capacity' using errcode = '22023';
    end if;

    if p_local_start_time is not null then
      if p_local_end_time <= p_local_start_time
         or extract(epoch from (p_local_end_time - p_local_start_time)) / 60 < schedule_context.duration_minutes then
        raise exception 'Special hours must contain at least one complete visit' using errcode = '22023';
      end if;
    end if;
  end if;

  -- We never rewrite inventory after a checkout has referenced a concrete
  -- session. This keeps historical orders and paid capacity immutable.
  if exists (
    select 1
      from public.sessions session
     where session.schedule_id = p_schedule_id
       and (session.starts_at at time zone schedule_context.timezone)::date = p_local_date
       and (
         exists (select 1 from public.order_items item where item.session_id = session.id)
         or exists (select 1 from public.inventory_holds hold where hold.session_id = session.id)
       )
  ) then
    raise exception 'This date already has checkout activity and cannot be changed automatically' using errcode = 'P0001';
  end if;

  delete from public.sessions session
   where session.schedule_id = p_schedule_id
     and (session.starts_at at time zone schedule_context.timezone)::date = p_local_date;

  insert into public.product_schedule_exceptions (
    schedule_id,
    local_date,
    is_closed,
    local_start_time,
    local_end_time,
    capacity,
    reason
  ) values (
    p_schedule_id,
    p_local_date,
    p_mode = 'closed',
    case when p_mode = 'override' then p_local_start_time else null end,
    case when p_mode = 'override' then p_local_end_time else null end,
    case when p_mode = 'override' then p_capacity else null end,
    nullif(btrim(coalesce(p_reason, '')), '')
  )
  on conflict (schedule_id, local_date) do update
    set is_closed = excluded.is_closed,
        local_start_time = excluded.local_start_time,
        local_end_time = excluded.local_end_time,
        capacity = excluded.capacity,
        reason = excluded.reason,
        updated_at = now()
  returning id into new_exception_id;

  if p_mode = 'override' then
    generated_count := public.ticketing_generate_sessions(
      schedule_context.product_id,
      p_local_date,
      p_local_date
    );
  end if;

  return query select new_exception_id, generated_count;
end;
$$;

create or replace function public.ticketing_clear_schedule_exception(
  p_schedule_id uuid,
  p_local_date date
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_user_id uuid := auth.uid();
  schedule_context record;
  generated_count integer := 0;
begin
  if actor_user_id is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  select schedule.product_id, venue.timezone, venue.organization_id
    into schedule_context
    from public.product_schedules schedule
    join public.products product on product.id = schedule.product_id
    join public.venues venue on venue.id = product.venue_id
   where schedule.id = p_schedule_id;

  if not found then
    raise exception 'Schedule does not exist' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
      from public.organization_memberships membership
     where membership.organization_id = schedule_context.organization_id
       and membership.user_id = actor_user_id
       and membership.role in ('owner', 'admin', 'manager')
  ) then
    raise exception 'You cannot manage this schedule' using errcode = '42501';
  end if;

  if p_local_date < current_date or p_local_date > current_date + 366 then
    raise exception 'Availability exception date must be within the next 366 days' using errcode = '22023';
  end if;

  if exists (
    select 1
      from public.sessions session
     where session.schedule_id = p_schedule_id
       and (session.starts_at at time zone schedule_context.timezone)::date = p_local_date
       and (
         exists (select 1 from public.order_items item where item.session_id = session.id)
         or exists (select 1 from public.inventory_holds hold where hold.session_id = session.id)
       )
  ) then
    raise exception 'This date already has checkout activity and cannot be changed automatically' using errcode = 'P0001';
  end if;

  delete from public.sessions session
   where session.schedule_id = p_schedule_id
     and (session.starts_at at time zone schedule_context.timezone)::date = p_local_date;

  delete from public.product_schedule_exceptions exception
   where exception.schedule_id = p_schedule_id
     and exception.local_date = p_local_date;

  generated_count := public.ticketing_generate_sessions(
    schedule_context.product_id,
    p_local_date,
    p_local_date
  );

  return generated_count;
end;
$$;

revoke all on function public.ticketing_set_schedule_exception(uuid, date, text, time, time, integer, text)
  from public, anon, authenticated;
revoke all on function public.ticketing_clear_schedule_exception(uuid, date)
  from public, anon, authenticated;

grant execute on function public.ticketing_set_schedule_exception(uuid, date, text, time, time, integer, text)
  to authenticated, service_role;
grant execute on function public.ticketing_clear_schedule_exception(uuid, date)
  to authenticated, service_role;

comment on function public.ticketing_set_schedule_exception(uuid, date, text, time, time, integer, text) is
  'Sets a closure or special-hours/capacity exception and safely rematerializes unreferenced sessions for that local date.';
comment on function public.ticketing_clear_schedule_exception(uuid, date) is
  'Removes one availability exception and restores sessions from the recurring weekly rule when safe.';

create or replace function public.ticketing_add_organizer_attraction_v2(
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
  p_product_description text,
  p_duration_minutes integer,
  p_ticket_name text,
  p_ticket_description text,
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
     or char_length(btrim(coalesce(p_city, ''))) not between 2 and 120
     or char_length(btrim(coalesce(p_product_name, ''))) not between 2 and 180 then
    raise exception 'Valid attraction and offer details are required' using errcode = '22023';
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
     where char_length(image.value) > 2048 or image.value !~ '^https://res\\.cloudinary\\.com/'
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
      nullif(btrim(coalesce(p_product_description, '')), ''),
      p_duration_minutes,
      jsonb_build_array(jsonb_build_object(
        'name', p_ticket_name,
        'description', nullif(btrim(coalesce(p_ticket_description, '')), ''),
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

revoke all on function public.ticketing_add_organizer_attraction_v2(
  uuid, text, text, text, uuid, text, text, text, numeric, numeric, jsonb,
  public.ticketing_sales_mode, text, text, text, integer, text, text, numeric,
  smallint[], time, time, integer, date
) from public, anon, authenticated;

grant execute on function public.ticketing_add_organizer_attraction_v2(
  uuid, text, text, text, uuid, text, text, text, numeric, numeric, jsonb,
  public.ticketing_sales_mode, text, text, text, integer, text, text, numeric,
  smallint[], time, time, integer, date
) to authenticated, service_role;

comment on function public.ticketing_add_organizer_attraction_v2(
  uuid, text, text, text, uuid, text, text, text, numeric, numeric, jsonb,
  public.ticketing_sales_mode, text, text, text, integer, text, text, numeric,
  smallint[], time, time, integer, date
) is 'Adds an attraction to an existing organization with an explicit offer and first ticket variant.';

commit;
