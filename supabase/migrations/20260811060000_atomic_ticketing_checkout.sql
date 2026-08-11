-- EnjoyHubAI ticketing core - stage 1B
--
-- The write path is intentionally server-only. The application backend calls
-- these SECURITY DEFINER functions with service_role after validating and rate
-- limiting the request. Browser clients retain read-only access to orders.

begin;

alter table public.orders
  add column if not exists checkout_key uuid;

create unique index if not exists orders_checkout_key_idx
  on public.orders(checkout_key)
  where checkout_key is not null;

create index if not exists inventory_holds_session_reserved_idx
  on public.inventory_holds(session_id, status, expires_at)
  where status in ('active', 'converted');

-- Public, read-only availability. Active holds count only until they expire;
-- converted holds represent sold capacity and keep counting without a timeout.
create or replace function public.ticketing_get_session_availability(
  p_session_id uuid
)
returns table (
  session_id uuid,
  capacity_units integer,
  reserved_capacity_units integer,
  available_capacity_units integer,
  is_sellable boolean,
  calculated_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with session_inventory as (
    select
      session.id,
      session.capacity,
      session.starts_at,
      session.sales_starts_at,
      session.sales_ends_at,
      session.status,
      product.booking_notice_minutes,
      coalesce(sum(hold.capacity_units) filter (
        where hold.status = 'converted'
          or (hold.status = 'active' and hold.expires_at > now())
      ), 0)::integer as reserved_capacity
    from public.sessions session
    join public.products product on product.id = session.product_id
    join public.venues venue on venue.id = product.venue_id
    left join public.inventory_holds hold on hold.session_id = session.id
    where session.id = p_session_id
      and session.status = 'scheduled'
      and product.status = 'active'
      and venue.status = 'active'
    group by
      session.id,
      session.capacity,
      session.starts_at,
      session.sales_starts_at,
      session.sales_ends_at,
      session.status,
      product.booking_notice_minutes
  )
  select
    inventory.id,
    inventory.capacity,
    inventory.reserved_capacity,
    greatest(inventory.capacity - inventory.reserved_capacity, 0),
    inventory.status = 'scheduled'
      and now() < inventory.starts_at
      and (
        inventory.sales_starts_at is null
        or inventory.sales_starts_at <= now()
      )
      and (
        inventory.sales_ends_at is null
        or inventory.sales_ends_at > now()
      )
      and now() <= inventory.starts_at
        - make_interval(mins => inventory.booking_notice_minutes)
      and inventory.capacity > inventory.reserved_capacity,
    now()
  from session_inventory inventory;
$$;

-- Bounded cleanup suitable for a scheduled server job. SKIP LOCKED allows
-- multiple workers to run safely without waiting on the same holds.
create or replace function public.ticketing_expire_inventory_holds(
  p_limit integer default 1000
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  expired_count integer := 0;
  expired_order_ids uuid[];
begin
  if p_limit is null or p_limit < 1 or p_limit > 10000 then
    raise exception 'Expiry batch size must be between 1 and 10000'
      using errcode = '22023';
  end if;

  with candidates as (
    select hold.id
    from public.inventory_holds hold
    where hold.status = 'active'
      and hold.expires_at <= now()
    order by hold.expires_at
    for update skip locked
    limit p_limit
  ), expired as (
    update public.inventory_holds hold
       set status = 'expired'
      from candidates
     where hold.id = candidates.id
    returning hold.order_id
  )
  select count(*)::integer, array_agg(order_id)
    into expired_count, expired_order_ids
    from expired;

  if expired_order_ids is not null then
    update public.orders customer_order
       set status = 'expired'
     where customer_order.id = any(expired_order_ids)
       and customer_order.status = 'awaiting_payment';
  end if;

  return expired_count;
end;
$$;

-- Creates one order for one session. Locking the session serializes competing
-- checkouts, so each caller sees capacity reserved by the previous commit.
create or replace function public.ticketing_create_order_hold(
  p_checkout_key uuid,
  p_session_id uuid,
  p_customer_name text,
  p_customer_email text,
  p_items jsonb,
  p_customer_user_id uuid default null,
  p_customer_phone text default null,
  p_source public.ticketing_order_source default 'enjoyhub_marketplace',
  p_hold_minutes integer default 15,
  p_terms_accepted boolean default false,
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  created_order_id uuid,
  created_order_number bigint,
  created_hold_token uuid,
  hold_expires_at timestamptz,
  created_total_amount numeric(12, 2),
  created_currency text,
  reserved_capacity_units integer,
  available_capacity_units integer,
  current_hold_status public.ticketing_hold_status,
  current_order_status public.ticketing_order_status
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  session_context record;
  existing_order record;
  item_count integer;
  distinct_item_count integer;
  requested_capacity integer;
  reserved_capacity integer;
  subtotal numeric(12, 2);
  order_currency text;
  currency_count integer;
  new_order_id uuid;
  new_order_number bigint;
  new_hold_token uuid;
  new_expires_at timestamptz;
  checkout_time timestamptz := clock_timestamp();
begin
  if p_checkout_key is null or p_session_id is null then
    raise exception 'Checkout key and session are required'
      using errcode = '22023';
  end if;

  if char_length(btrim(coalesce(p_customer_name, ''))) not between 2 and 160 then
    raise exception 'Customer name must contain between 2 and 160 characters'
      using errcode = '22023';
  end if;

  if char_length(btrim(coalesce(p_customer_email, ''))) not between 3 and 254
     or position('@' in btrim(p_customer_email)) <= 1 then
    raise exception 'A valid customer email is required'
      using errcode = '22023';
  end if;

  if p_hold_minutes is null or p_hold_minutes < 1 or p_hold_minutes > 30 then
    raise exception 'Hold duration must be between 1 and 30 minutes'
      using errcode = '22023';
  end if;

  if p_terms_accepted is distinct from true then
    raise exception 'Terms must be accepted before checkout'
      using errcode = '22023';
  end if;

  if p_metadata is null or jsonb_typeof(p_metadata) <> 'object' then
    raise exception 'Checkout metadata must be a JSON object'
      using errcode = '22023';
  end if;

  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0
     or jsonb_array_length(p_items) > 20 then
    raise exception 'Checkout items must contain between 1 and 20 entries'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) item
    where jsonb_typeof(item) <> 'object'
      or coalesce(item ->> 'ticket_type_id', '')
        !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or coalesce(item ->> 'quantity', '') !~ '^[1-9][0-9]*$'
  ) then
    raise exception 'Every checkout item needs a valid ticket_type_id and quantity'
      using errcode = '22023';
  end if;

  select
    session.id as session_id,
    session.capacity,
    session.starts_at,
    session.sales_starts_at,
    session.sales_ends_at,
    session.status as session_status,
    product.id as product_id,
    product.name as product_name,
    product.min_participants,
    product.max_participants,
    product.booking_notice_minutes,
    product.inventory_mode,
    product.status as product_status,
    venue.id as venue_id,
    venue.organization_id,
    venue.status as venue_status
    into session_context
    from public.sessions session
    join public.products product on product.id = session.product_id
    join public.venues venue on venue.id = product.venue_id
   where session.id = p_session_id
   for update of session;

  if not found then
    raise exception 'Ticketing session does not exist'
      using errcode = 'P0002';
  end if;

  update public.inventory_holds hold
     set status = 'expired'
   where hold.session_id = p_session_id
     and hold.status = 'active'
     and hold.expires_at <= checkout_time;

  update public.orders customer_order
     set status = 'expired'
   where customer_order.status = 'awaiting_payment'
     and exists (
       select 1
       from public.inventory_holds hold
       where hold.order_id = customer_order.id
         and hold.session_id = p_session_id
         and hold.status = 'expired'
     );

  select
    customer_order.id,
    customer_order.order_number,
    customer_order.customer_user_id,
    customer_order.customer_name,
    customer_order.customer_email,
    customer_order.source,
    customer_order.total_amount,
    customer_order.currency,
    customer_order.status as order_status,
    hold.hold_token,
    hold.expires_at,
    hold.capacity_units,
    hold.status as hold_status,
    hold.session_id
    into existing_order
    from public.orders customer_order
    join public.inventory_holds hold on hold.order_id = customer_order.id
   where customer_order.checkout_key = p_checkout_key;

  if found then
    if existing_order.session_id <> p_session_id
       or existing_order.customer_user_id is distinct from p_customer_user_id
       or existing_order.customer_name <> btrim(p_customer_name)
       or lower(existing_order.customer_email) <> lower(btrim(p_customer_email))
       or existing_order.source <> p_source then
      raise exception 'Checkout key has already been used for another request'
        using errcode = '23505';
    end if;

    if exists (
      with requested as (
        select
          (item ->> 'ticket_type_id')::uuid as ticket_type_id,
          (item ->> 'quantity')::integer as quantity
        from jsonb_array_elements(p_items) item
      ), stored as (
        select item.ticket_type_id, item.quantity
        from public.order_items item
        where item.order_id = existing_order.id
      )
      select 1
      from requested
      full join stored using (ticket_type_id)
      where requested.quantity is distinct from stored.quantity
    ) then
      raise exception 'Checkout key has already been used with different items'
        using errcode = '23505';
    end if;

    select coalesce(sum(hold.capacity_units) filter (
      where hold.status = 'converted'
        or (hold.status = 'active' and hold.expires_at > checkout_time)
    ), 0)::integer
      into reserved_capacity
      from public.inventory_holds hold
     where hold.session_id = p_session_id;

    return query select
      existing_order.id,
      existing_order.order_number,
      existing_order.hold_token,
      existing_order.expires_at,
      existing_order.total_amount,
      existing_order.currency,
      existing_order.capacity_units,
      greatest(session_context.capacity - reserved_capacity, 0),
      existing_order.hold_status,
      existing_order.order_status;
    return;
  end if;

  if session_context.session_status <> 'scheduled'
     or session_context.product_status <> 'active'
     or session_context.venue_status <> 'active'
     or session_context.inventory_mode not in ('native_enjoyhub', 'allocated_quota') then
    raise exception 'This session is not available for EnjoyHub checkout'
      using errcode = 'P0001';
  end if;

  if checkout_time >= session_context.starts_at
     or (
       session_context.sales_starts_at is not null
       and checkout_time < session_context.sales_starts_at
     )
     or (
       session_context.sales_ends_at is not null
       and checkout_time >= session_context.sales_ends_at
     )
     or checkout_time > session_context.starts_at
       - make_interval(mins => session_context.booking_notice_minutes) then
    raise exception 'Sales are closed for this session'
      using errcode = 'P0001';
  end if;

  with requested as (
    select
      (item ->> 'ticket_type_id')::uuid as ticket_type_id,
      (item ->> 'quantity')::integer as quantity
    from jsonb_array_elements(p_items) item
  )
  select count(*)::integer, count(distinct ticket_type_id)::integer
    into item_count, distinct_item_count
    from requested;

  if item_count <> distinct_item_count then
    raise exception 'A ticket type may appear only once in checkout items'
      using errcode = '22023';
  end if;

  if exists (
    with requested as (
      select
        (item ->> 'ticket_type_id')::uuid as ticket_type_id,
        (item ->> 'quantity')::integer as quantity
      from jsonb_array_elements(p_items) item
    )
    select 1
    from requested
    left join public.ticket_types ticket
      on ticket.id = requested.ticket_type_id
    where ticket.id is null
      or ticket.product_id <> session_context.product_id
      or not ticket.is_active
      or requested.quantity < ticket.min_quantity_per_order
      or (
        ticket.max_quantity_per_order is not null
        and requested.quantity > ticket.max_quantity_per_order
      )
  ) then
    raise exception 'Checkout contains an unavailable ticket type or invalid quantity'
      using errcode = '22023';
  end if;

  with requested as (
    select
      (item ->> 'ticket_type_id')::uuid as ticket_type_id,
      (item ->> 'quantity')::integer as quantity
    from jsonb_array_elements(p_items) item
  )
  select
    sum(requested.quantity * ticket.capacity_units)::integer,
    sum(requested.quantity * ticket.price_amount)::numeric(12, 2),
    min(ticket.currency),
    count(distinct ticket.currency)::integer
    into requested_capacity, subtotal, order_currency, currency_count
    from requested
    join public.ticket_types ticket on ticket.id = requested.ticket_type_id;

  if currency_count <> 1 then
    raise exception 'All checkout items must use the same currency'
      using errcode = '22023';
  end if;

  if requested_capacity < session_context.min_participants
     or (
       session_context.max_participants is not null
       and requested_capacity > session_context.max_participants
     ) then
    raise exception 'Checkout participant count is outside product limits'
      using errcode = '22023';
  end if;

  select coalesce(sum(hold.capacity_units) filter (
    where hold.status = 'converted'
      or (hold.status = 'active' and hold.expires_at > checkout_time)
  ), 0)::integer
    into reserved_capacity
    from public.inventory_holds hold
   where hold.session_id = p_session_id;

  if requested_capacity > session_context.capacity - reserved_capacity then
    raise exception 'Insufficient capacity: requested %, available %',
      requested_capacity,
      greatest(session_context.capacity - reserved_capacity, 0)
      using errcode = 'P0001';
  end if;

  new_expires_at := checkout_time + make_interval(mins => p_hold_minutes);

  insert into public.orders (
    checkout_key,
    organization_id,
    venue_id,
    customer_user_id,
    customer_name,
    customer_email,
    customer_phone,
    source,
    status,
    payment_status,
    currency,
    subtotal_amount,
    discount_amount,
    total_amount,
    expires_at,
    terms_accepted_at,
    metadata
  ) values (
    p_checkout_key,
    session_context.organization_id,
    session_context.venue_id,
    p_customer_user_id,
    btrim(p_customer_name),
    lower(btrim(p_customer_email)),
    nullif(btrim(p_customer_phone), ''),
    p_source,
    'awaiting_payment',
    'unpaid',
    order_currency,
    subtotal,
    0,
    subtotal,
    new_expires_at,
    checkout_time,
    p_metadata
  )
  returning id, order_number into new_order_id, new_order_number;

  with requested as (
    select
      (item ->> 'ticket_type_id')::uuid as ticket_type_id,
      (item ->> 'quantity')::integer as quantity
    from jsonb_array_elements(p_items) item
  )
  insert into public.order_items (
    order_id,
    product_id,
    session_id,
    ticket_type_id,
    product_name,
    ticket_type_name,
    quantity,
    capacity_units_each,
    unit_price_amount,
    total_price_amount
  )
  select
    new_order_id,
    session_context.product_id,
    p_session_id,
    ticket.id,
    session_context.product_name,
    ticket.name,
    requested.quantity,
    ticket.capacity_units,
    ticket.price_amount,
    requested.quantity * ticket.price_amount
  from requested
  join public.ticket_types ticket on ticket.id = requested.ticket_type_id;

  insert into public.inventory_holds (
    session_id,
    order_id,
    capacity_units,
    status,
    expires_at
  ) values (
    p_session_id,
    new_order_id,
    requested_capacity,
    'active',
    new_expires_at
  )
  returning hold_token into new_hold_token;

  return query select
    new_order_id,
    new_order_number,
    new_hold_token,
    new_expires_at,
    subtotal,
    order_currency,
    requested_capacity,
    session_context.capacity - reserved_capacity - requested_capacity,
    'active'::public.ticketing_hold_status,
    'awaiting_payment'::public.ticketing_order_status;
end;
$$;

-- Payment webhooks can be retried. Returning an already converted order makes
-- confirmation idempotent while rejecting expired or released holds.
create or replace function public.ticketing_confirm_order(
  p_order_id uuid,
  p_hold_token uuid,
  p_payment_metadata jsonb default '{}'::jsonb
)
returns table (
  confirmed_order_id uuid,
  current_order_status public.ticketing_order_status,
  current_payment_status public.ticketing_payment_status,
  order_confirmed_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  checkout_state record;
  confirmation_time timestamptz := clock_timestamp();
begin
  if p_payment_metadata is null
     or jsonb_typeof(p_payment_metadata) <> 'object' then
    raise exception 'Payment metadata must be a JSON object'
      using errcode = '22023';
  end if;

  select
    customer_order.status as order_status,
    customer_order.payment_status,
    customer_order.confirmed_at,
    hold.status as hold_status,
    hold.expires_at
    into checkout_state
    from public.orders customer_order
    join public.inventory_holds hold on hold.order_id = customer_order.id
   where customer_order.id = p_order_id
     and hold.hold_token = p_hold_token
   for update of customer_order, hold;

  if not found then
    raise exception 'Order and hold token do not match'
      using errcode = 'P0002';
  end if;

  if checkout_state.order_status = 'confirmed'
     and checkout_state.payment_status = 'paid'
     and checkout_state.hold_status = 'converted' then
    return query select
      p_order_id,
      checkout_state.order_status,
      checkout_state.payment_status,
      checkout_state.confirmed_at;
    return;
  end if;

  if checkout_state.order_status <> 'awaiting_payment'
     or checkout_state.hold_status <> 'active' then
    raise exception 'Order is not awaiting an active payment hold'
      using errcode = 'P0001';
  end if;

  if checkout_state.expires_at <= confirmation_time then
    raise exception 'Inventory hold has expired'
      using errcode = 'P0001';
  end if;

  update public.inventory_holds
     set status = 'converted',
         converted_at = confirmation_time
   where order_id = p_order_id
     and hold_token = p_hold_token;

  update public.orders
     set status = 'confirmed',
         payment_status = 'paid',
         confirmed_at = confirmation_time,
         metadata = metadata || jsonb_build_object('payment', p_payment_metadata)
   where id = p_order_id;

  return query select
    p_order_id,
    'confirmed'::public.ticketing_order_status,
    'paid'::public.ticketing_payment_status,
    confirmation_time;
end;
$$;

-- Releases only unpaid capacity. Confirmed orders require a separate refund or
-- cancellation flow so that paid inventory is never freed accidentally.
create or replace function public.ticketing_release_order_hold(
  p_order_id uuid,
  p_hold_token uuid
)
returns table (
  released_order_id uuid,
  current_order_status public.ticketing_order_status,
  current_hold_status public.ticketing_hold_status
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  checkout_state record;
  release_time timestamptz := clock_timestamp();
begin
  select
    customer_order.status as order_status,
    hold.status as hold_status,
    hold.expires_at
    into checkout_state
    from public.orders customer_order
    join public.inventory_holds hold on hold.order_id = customer_order.id
   where customer_order.id = p_order_id
     and hold.hold_token = p_hold_token
   for update of customer_order, hold;

  if not found then
    raise exception 'Order and hold token do not match'
      using errcode = 'P0002';
  end if;

  if checkout_state.hold_status in ('released', 'expired') then
    return query select
      p_order_id,
      checkout_state.order_status,
      checkout_state.hold_status;
    return;
  end if;

  if checkout_state.hold_status = 'converted' then
    raise exception 'A converted hold cannot be released without cancellation'
      using errcode = 'P0001';
  end if;

  if checkout_state.expires_at <= release_time then
    update public.inventory_holds
       set status = 'expired'
     where order_id = p_order_id
       and hold_token = p_hold_token;

    update public.orders
       set status = 'expired'
     where id = p_order_id
       and status = 'awaiting_payment';

    return query select
      p_order_id,
      'expired'::public.ticketing_order_status,
      'expired'::public.ticketing_hold_status;
    return;
  end if;

  update public.inventory_holds
     set status = 'released'
   where order_id = p_order_id
     and hold_token = p_hold_token;

  update public.orders
     set status = 'cancelled',
         cancelled_at = release_time
   where id = p_order_id
     and status = 'awaiting_payment';

  return query select
    p_order_id,
    'cancelled'::public.ticketing_order_status,
    'released'::public.ticketing_hold_status;
end;
$$;

-- Materializes recurring local-time schedules into concrete UTC sessions.
-- Existing sessions are never overwritten, keeping booked capacity stable.
create or replace function public.ticketing_generate_sessions(
  p_product_id uuid,
  p_from date,
  p_until date
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  product_context record;
  inserted_count integer := 0;
begin
  if p_product_id is null or p_from is null or p_until is null then
    raise exception 'Product and date range are required'
      using errcode = '22023';
  end if;

  if p_until < p_from or p_until - p_from > 366 then
    raise exception 'Session generation range must contain at most 367 days'
      using errcode = '22023';
  end if;

  select
    product.duration_minutes,
    venue.timezone
    into product_context
    from public.products product
    join public.venues venue on venue.id = product.venue_id
   where product.id = p_product_id;

  if not found then
    raise exception 'Ticketing product does not exist'
      using errcode = 'P0002';
  end if;

  with local_dates as (
    select generated_at::date as local_date
    from generate_series(p_from, p_until, interval '1 day') generated_at
  ), resolved_schedules as (
    select
      schedule.id as schedule_id,
      schedule.product_id,
      local_dates.local_date,
      coalesce(exception.local_start_time, schedule.local_start_time) as local_start_time,
      coalesce(exception.local_end_time, schedule.local_end_time) as local_end_time,
      schedule.slot_interval_minutes,
      coalesce(exception.capacity, schedule.capacity) as capacity,
      schedule.sales_cutoff_minutes
    from public.product_schedules schedule
    join local_dates
      on extract(isodow from local_dates.local_date)::integer = schedule.weekday
    left join public.product_schedule_exceptions exception
      on exception.schedule_id = schedule.id
     and exception.local_date = local_dates.local_date
    where schedule.product_id = p_product_id
      and schedule.is_active
      and local_dates.local_date >= schedule.valid_from
      and (
        schedule.valid_until is null
        or local_dates.local_date <= schedule.valid_until
      )
      and not coalesce(exception.is_closed, false)
  ), generated_slots as (
    select
      resolved.schedule_id,
      resolved.product_id,
      resolved.capacity,
      resolved.sales_cutoff_minutes,
      slot.local_start
    from resolved_schedules resolved
    cross join lateral generate_series(
      resolved.local_date + resolved.local_start_time,
      resolved.local_date + resolved.local_end_time
        - make_interval(mins => product_context.duration_minutes),
      make_interval(mins => resolved.slot_interval_minutes)
    ) as slot(local_start)
  )
  insert into public.sessions (
    product_id,
    schedule_id,
    starts_at,
    ends_at,
    capacity,
    sales_ends_at,
    status
  )
  select
    generated.product_id,
    generated.schedule_id,
    generated.local_start at time zone product_context.timezone,
    (generated.local_start
      + make_interval(mins => product_context.duration_minutes))
      at time zone product_context.timezone,
    generated.capacity,
    (generated.local_start at time zone product_context.timezone)
      - make_interval(mins => generated.sales_cutoff_minutes),
    'scheduled'
  from generated_slots generated
  on conflict (product_id, starts_at) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke all on function public.ticketing_get_session_availability(uuid) from public;
revoke all on function public.ticketing_expire_inventory_holds(integer) from public;
revoke all on function public.ticketing_create_order_hold(
  uuid, uuid, text, text, jsonb, uuid, text,
  public.ticketing_order_source, integer, boolean, jsonb
) from public;
revoke all on function public.ticketing_confirm_order(uuid, uuid, jsonb) from public;
revoke all on function public.ticketing_release_order_hold(uuid, uuid) from public;
revoke all on function public.ticketing_generate_sessions(uuid, date, date) from public;

grant execute on function public.ticketing_get_session_availability(uuid)
  to anon, authenticated, service_role;

grant execute on function public.ticketing_expire_inventory_holds(integer)
  to service_role;
grant execute on function public.ticketing_create_order_hold(
  uuid, uuid, text, text, jsonb, uuid, text,
  public.ticketing_order_source, integer, boolean, jsonb
) to service_role;
grant execute on function public.ticketing_confirm_order(uuid, uuid, jsonb)
  to service_role;
grant execute on function public.ticketing_release_order_hold(uuid, uuid)
  to service_role;
grant execute on function public.ticketing_generate_sessions(uuid, date, date)
  to service_role;

comment on column public.orders.checkout_key is
  'Server-generated idempotency key preventing duplicate checkout orders.';
comment on function public.ticketing_create_order_hold(
  uuid, uuid, text, text, jsonb, uuid, text,
  public.ticketing_order_source, integer, boolean, jsonb
) is 'Atomically creates an awaiting-payment order, line items and one inventory hold.';
comment on function public.ticketing_confirm_order(uuid, uuid, jsonb) is
  'Idempotently converts an active inventory hold after confirmed payment.';
comment on function public.ticketing_generate_sessions(uuid, date, date) is
  'Generates missing UTC sessions from local recurring schedules without overwriting existing inventory.';

commit;
