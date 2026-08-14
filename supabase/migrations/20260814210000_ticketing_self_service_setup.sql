-- EnjoyHubAI ticketing core - stage 2A
--
-- Self-service launch for an authenticated owner, administrator or manager.
-- The setup function creates a complete, immediately sellable configuration in
-- one transaction. The maintenance function keeps future sessions generated so
-- owners do not need to operate the database manually.

begin;

create or replace function public.ticketing_create_sales_setup(
  p_organization_id uuid,
  p_existing_venue_id uuid,
  p_organization_name text,
  p_venue_name text,
  p_venue_slug text,
  p_venue_description text,
  p_address_line_1 text,
  p_postal_code text,
  p_city text,
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
  created_product_id uuid,
  generated_session_count integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_user_id uuid := auth.uid();
  selected_organization_id uuid;
  selected_venue_id uuid;
  selected_venue_mode public.ticketing_sales_mode;
  new_product_id uuid;
  ticket jsonb;
  ticket_name text;
  ticket_description text;
  ticket_price numeric(12, 2);
  ticket_capacity_units integer;
  ticket_max_quantity integer;
  ticket_sort_order integer := 0;
  distinct_weekday_count integer;
  generated_count integer;
begin
  if actor_user_id is null then
    raise exception 'Authentication is required to configure ticket sales'
      using errcode = '42501';
  end if;

  if p_sales_mode not in ('native_enjoyhub', 'allocated_quota') then
    raise exception 'Self-service setup supports native or allocated inventory only'
      using errcode = '22023';
  end if;

  if char_length(btrim(coalesce(p_product_name, ''))) not between 2 and 180
     or p_product_slug is null
     or p_product_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'A valid product name and slug are required'
      using errcode = '22023';
  end if;

  if p_duration_minutes not between 1 and 1440
     or p_capacity not between 1 and 100000
     or p_slot_interval_minutes not between 1 and 1440
     or p_sales_cutoff_minutes not between 0 and 10080 then
    raise exception 'Invalid duration, capacity, interval or sales cutoff'
      using errcode = '22023';
  end if;

  if p_local_start_time is null
     or p_local_end_time is null
     or p_local_end_time <= p_local_start_time
     or extract(epoch from (p_local_end_time - p_local_start_time)) / 60 < p_duration_minutes then
    raise exception 'Opening hours must contain at least one complete session'
      using errcode = '22023';
  end if;

  if p_generate_until is null
     or p_generate_until < current_date
     or p_generate_until > current_date + 366 then
    raise exception 'Initial session generation must end within 366 days'
      using errcode = '22023';
  end if;

  if p_weekdays is null or cardinality(p_weekdays) = 0 then
    raise exception 'At least one weekday is required'
      using errcode = '22023';
  end if;

  if exists (
    select 1 from unnest(p_weekdays) weekday
    where weekday not between 1 and 7
  ) then
    raise exception 'Weekdays must use ISO values from 1 to 7'
      using errcode = '22023';
  end if;

  select count(distinct weekday)::integer
    into distinct_weekday_count
    from unnest(p_weekdays) weekday;

  if distinct_weekday_count > 7 then
    raise exception 'Too many weekdays'
      using errcode = '22023';
  end if;

  if jsonb_typeof(p_ticket_types) <> 'array'
     or jsonb_array_length(p_ticket_types) not between 1 and 10 then
    raise exception 'Between one and ten ticket types are required'
      using errcode = '22023';
  end if;

  if p_existing_venue_id is not null then
    select venue.organization_id, venue.sales_mode
      into selected_organization_id, selected_venue_mode
      from public.venues venue
      join public.organizations organization
        on organization.id = venue.organization_id
     where venue.id = p_existing_venue_id
       and organization.status = 'active'
       and venue.status not in ('suspended', 'archived');

    if not found then
      raise exception 'Selected venue is not available'
        using errcode = 'P0002';
    end if;

    if p_organization_id is not null
       and p_organization_id <> selected_organization_id then
      raise exception 'Selected organization and venue do not match'
        using errcode = '22023';
    end if;

    if selected_venue_mode not in ('native_enjoyhub', 'allocated_quota') then
      raise exception 'Selected venue requires an integration setup'
        using errcode = '22023';
    end if;

    if not exists (
      select 1
      from public.organization_memberships membership
      where membership.organization_id = selected_organization_id
        and membership.user_id = actor_user_id
        and membership.role in ('owner', 'admin', 'manager')
    ) then
      raise exception 'You cannot configure ticket sales for this venue'
        using errcode = '42501';
    end if;

    selected_venue_id := p_existing_venue_id;

    update public.venues
       set status = 'active'
     where id = selected_venue_id
       and status = 'draft';
  else
    if p_organization_id is null then
      if char_length(btrim(coalesce(p_organization_name, ''))) not between 2 and 160 then
        raise exception 'A valid organization name is required'
          using errcode = '22023';
      end if;

      insert into public.organizations (name, created_by)
      values (btrim(p_organization_name), actor_user_id)
      returning id into selected_organization_id;
    else
      select organization.id
        into selected_organization_id
        from public.organizations organization
       where organization.id = p_organization_id
         and organization.status = 'active';

      if not found or not exists (
        select 1
        from public.organization_memberships membership
        where membership.organization_id = selected_organization_id
          and membership.user_id = actor_user_id
          and membership.role in ('owner', 'admin', 'manager')
      ) then
        raise exception 'You cannot configure ticket sales for this organization'
          using errcode = '42501';
      end if;
    end if;

    if char_length(btrim(coalesce(p_venue_name, ''))) not between 2 and 160
       or p_venue_slug is null
       or p_venue_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
      raise exception 'A valid venue name and slug are required'
        using errcode = '22023';
    end if;

    insert into public.venues (
      organization_id,
      name,
      slug,
      description,
      address_line_1,
      postal_code,
      city,
      country_code,
      timezone,
      default_currency,
      sales_mode,
      status,
      created_by
    ) values (
      selected_organization_id,
      btrim(p_venue_name),
      p_venue_slug,
      nullif(btrim(coalesce(p_venue_description, '')), ''),
      nullif(btrim(coalesce(p_address_line_1, '')), ''),
      nullif(btrim(coalesce(p_postal_code, '')), ''),
      nullif(btrim(coalesce(p_city, '')), ''),
      'PL',
      'Europe/Warsaw',
      'PLN',
      p_sales_mode,
      'active',
      actor_user_id
    )
    returning id, sales_mode into selected_venue_id, selected_venue_mode;
  end if;

  insert into public.products (
    venue_id,
    name,
    slug,
    description,
    duration_minutes,
    min_participants,
    max_participants,
    booking_notice_minutes,
    inventory_mode,
    status,
    created_by
  ) values (
    selected_venue_id,
    btrim(p_product_name),
    p_product_slug,
    nullif(btrim(coalesce(p_product_description, '')), ''),
    p_duration_minutes,
    1,
    p_capacity,
    p_sales_cutoff_minutes,
    selected_venue_mode,
    'active',
    actor_user_id
  )
  returning id into new_product_id;

  for ticket in
    select value from jsonb_array_elements(p_ticket_types)
  loop
    if jsonb_typeof(ticket) <> 'object' then
      raise exception 'Every ticket type must be an object'
        using errcode = '22023';
    end if;

    ticket_name := btrim(coalesce(ticket->>'name', ''));
    ticket_description := nullif(btrim(coalesce(ticket->>'description', '')), '');

    begin
      ticket_price := (ticket->>'price_amount')::numeric(12, 2);
      ticket_capacity_units := coalesce((ticket->>'capacity_units')::integer, 1);
      ticket_max_quantity := coalesce((ticket->>'max_quantity_per_order')::integer, 20);
    exception
      when invalid_text_representation or numeric_value_out_of_range then
        raise exception 'Ticket price, capacity and limit must be valid numbers'
          using errcode = '22023';
    end;

    if char_length(ticket_name) not between 1 and 120
       or ticket_price is null
       or ticket_price <= 0
       or ticket_capacity_units not between 1 and p_capacity
       or ticket_max_quantity not between 1 and 100 then
      raise exception 'Invalid ticket type configuration'
        using errcode = '22023';
    end if;

    insert into public.ticket_types (
      product_id,
      name,
      description,
      price_amount,
      currency,
      capacity_units,
      min_quantity_per_order,
      max_quantity_per_order,
      sort_order,
      is_active
    ) values (
      new_product_id,
      ticket_name,
      ticket_description,
      ticket_price,
      'PLN',
      ticket_capacity_units,
      1,
      ticket_max_quantity,
      ticket_sort_order,
      true
    );

    ticket_sort_order := ticket_sort_order + 1;
  end loop;

  insert into public.product_schedules (
    product_id,
    weekday,
    local_start_time,
    local_end_time,
    slot_interval_minutes,
    capacity,
    valid_from,
    sales_cutoff_minutes,
    is_active
  )
  select
    new_product_id,
    selected_weekday,
    p_local_start_time,
    p_local_end_time,
    p_slot_interval_minutes,
    p_capacity,
    current_date,
    p_sales_cutoff_minutes,
    true
  from (
    select distinct weekday as selected_weekday
    from unnest(p_weekdays) weekday
  ) selected_weekdays;

  generated_count := public.ticketing_generate_sessions(
    new_product_id,
    current_date,
    p_generate_until
  );

  if generated_count = 0 then
    raise exception 'The schedule did not generate any future sessions'
      using errcode = '22023';
  end if;

  return query select
    selected_organization_id,
    selected_venue_id,
    new_product_id,
    generated_count;
end;
$$;

create or replace function public.ticketing_extend_active_sessions(
  p_until date,
  p_limit integer
)
returns table (
  processed_product_count integer,
  generated_session_count integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  product_record record;
  processed_count integer := 0;
  generated_count integer := 0;
begin
  if p_until is null
     or p_until < current_date
     or p_until > current_date + 366 then
    raise exception 'Session extension must end within 366 days'
      using errcode = '22023';
  end if;

  if p_limit not between 1 and 1000 then
    raise exception 'Product batch size must be between 1 and 1000'
      using errcode = '22023';
  end if;

  for product_record in
    select product.id
    from public.products product
    join public.venues venue on venue.id = product.venue_id
    join public.organizations organization on organization.id = venue.organization_id
    where product.status = 'active'
      and venue.status = 'active'
      and organization.status = 'active'
      and product.inventory_mode in ('native_enjoyhub', 'allocated_quota')
      and exists (
        select 1
        from public.product_schedules schedule
        where schedule.product_id = product.id
          and schedule.is_active
      )
    order by (
      select max(session.starts_at)
      from public.sessions session
      where session.product_id = product.id
        and session.status = 'scheduled'
    ) asc nulls first, product.id
    limit p_limit
  loop
    processed_count := processed_count + 1;
    generated_count := generated_count + public.ticketing_generate_sessions(
      product_record.id,
      current_date,
      p_until
    );
  end loop;

  return query select processed_count, generated_count;
end;
$$;

revoke all on function public.ticketing_create_sales_setup(
  uuid, uuid, text, text, text, text, text, text, text,
  public.ticketing_sales_mode, text, text, text, integer, jsonb, smallint[],
  time, time, integer, integer, integer, date
) from public, anon, authenticated;

revoke all on function public.ticketing_extend_active_sessions(date, integer)
  from public, anon, authenticated;

grant execute on function public.ticketing_create_sales_setup(
  uuid, uuid, text, text, text, text, text, text, text,
  public.ticketing_sales_mode, text, text, text, integer, jsonb, smallint[],
  time, time, integer, integer, integer, date
) to authenticated, service_role;

grant execute on function public.ticketing_extend_active_sessions(date, integer)
  to service_role;

comment on function public.ticketing_create_sales_setup(
  uuid, uuid, text, text, text, text, text, text, text,
  public.ticketing_sales_mode, text, text, text, integer, jsonb, smallint[],
  time, time, integer, integer, integer, date
) is 'Atomically creates a self-service ticketing offer, prices, weekly schedule and initial sessions for an authenticated manager.';

comment on function public.ticketing_extend_active_sessions(date, integer) is
  'Idempotently extends future sessions for active native and allocated-quota products. Intended for a protected daily cron.';

commit;
