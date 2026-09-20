-- Organizer Operating System P0
-- Manual reservations, walk-ins, booking/payment metadata, operational calendar,
-- rescheduling and on-site payment settlement.
--
-- Additive / reversible: existing checkout, Stripe and ticket lifecycle remain
-- authoritative for marketplace orders.

begin;

alter table public.orders
  add column if not exists booking_source text,
  add column if not exists payment_method text;

alter table public.orders
  alter column customer_email drop not null;

update public.orders
set booking_source = case source::text
  when 'enjoyhub_marketplace' then 'marketplace'
  when 'venue_widget' then 'widget'
  when 'box_office' then 'walk_in'
  when 'phone' then 'phone'
  when 'integration' then 'integration'
  else 'marketplace'
end
where booking_source is null;

update public.orders
set payment_method = case
  when source::text in ('enjoyhub_marketplace', 'venue_widget') then 'online'
  when source::text = 'box_office' then 'on_site'
  else null
end
where payment_method is null;

alter table public.orders
  alter column booking_source set not null;

alter table public.orders
  add constraint orders_booking_source_check
  check (booking_source in ('marketplace','widget','manual','walk_in','phone','integration'));

alter table public.orders
  add constraint orders_payment_method_check
  check (payment_method is null or payment_method in ('online','on_site'));

create index if not exists orders_booking_source_created_at_idx
  on public.orders(booking_source, created_at desc);

create index if not exists orders_payment_method_status_idx
  on public.orders(payment_method, payment_status)
  where payment_method is not null;

-- Compatibility layer: existing marketplace/widget checkout functions still
-- write the legacy enum column `source`. Keep the new operating metadata in
-- sync without forcing a rewrite of the proven atomic checkout path.
create or replace function public.ticketing_sync_order_operating_metadata()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.booking_source is null then
    new.booking_source := case new.source::text
      when 'enjoyhub_marketplace' then 'marketplace'
      when 'venue_widget' then 'widget'
      when 'box_office' then 'walk_in'
      when 'phone' then 'phone'
      when 'integration' then 'integration'
      else 'marketplace'
    end;
  end if;

  if new.payment_method is null then
    new.payment_method := case
      when new.source::text in ('enjoyhub_marketplace','venue_widget') then 'online'
      when new.source::text = 'box_office' then 'on_site'
      else null
    end;
  end if;

  return new;
end;
$$;

drop trigger if exists ticketing_orders_operating_metadata on public.orders;
create trigger ticketing_orders_operating_metadata
before insert or update of source, booking_source, payment_method
on public.orders
for each row execute function public.ticketing_sync_order_operating_metadata();

create table if not exists public.booking_reschedules (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  from_session_id uuid not null references public.sessions(id) on delete restrict,
  to_session_id uuid not null references public.sessions(id) on delete restrict,
  changed_by uuid not null references auth.users(id) on delete restrict,
  reason text,
  created_at timestamptz not null default now(),
  check (from_session_id <> to_session_id)
);

create index if not exists booking_reschedules_order_created_idx
  on public.booking_reschedules(order_id, created_at desc);

alter table public.booking_reschedules enable row level security;

drop policy if exists booking_reschedules_select_org_members on public.booking_reschedules;
create policy booking_reschedules_select_org_members
on public.booking_reschedules for select to authenticated
using (
  exists (
    select 1
    from public.orders o
    where o.id = booking_reschedules.order_id
      and public.ticketing_is_org_member(
        o.organization_id,
        array['owner','admin','manager','viewer']::public.ticketing_member_role[]
      )
  )
);

revoke all on table public.booking_reschedules from public, anon, authenticated;
grant select on table public.booking_reschedules to authenticated;
grant all on table public.booking_reschedules to service_role;

-- Efficient organizer read model for month/day calendar views.
create or replace function public.ticketing_get_organizer_calendar(
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  session_id uuid,
  product_id uuid,
  product_name text,
  venue_id uuid,
  venue_name text,
  venue_city text,
  venue_timezone text,
  starts_at timestamptz,
  ends_at timestamptz,
  capacity integer,
  reserved_capacity_units integer,
  available_capacity_units integer,
  booking_count integer,
  session_status public.ticketing_session_status
)
language plpgsql
security definer
set search_path = public, auth, pg_temp
stable
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if p_from is null or p_to is null or p_to <= p_from
     or p_to > p_from + interval '370 days' then
    raise exception 'Invalid calendar range' using errcode = '22023';
  end if;

  return query
  select
    s.id,
    p.id,
    p.name,
    v.id,
    v.name,
    v.city,
    v.timezone,
    s.starts_at,
    s.ends_at,
    s.capacity,
    coalesce(inv.reserved, 0)::integer,
    greatest(s.capacity - coalesce(inv.reserved, 0), 0)::integer,
    coalesce(inv.bookings, 0)::integer,
    s.status
  from public.sessions s
  join public.products p on p.id = s.product_id
  join public.venues v on v.id = p.venue_id
  left join lateral (
    select
      coalesce(sum(h.capacity_units) filter (
        where h.status = 'converted'
          or (h.status = 'active' and h.expires_at > clock_timestamp())
      ), 0)::integer as reserved,
      count(distinct h.order_id) filter (
        where h.order_id is not null
          and (
            h.status = 'converted'
            or (h.status = 'active' and h.expires_at > clock_timestamp())
          )
      )::integer as bookings
    from public.inventory_holds h
    where h.session_id = s.id
  ) inv on true
  where s.starts_at >= p_from
    and s.starts_at < p_to
    and s.status in ('scheduled','sold_out')
    and public.ticketing_is_org_member(
      v.organization_id,
      array['owner','admin','manager','viewer']::public.ticketing_member_role[]
    )
  order by s.starts_at, p.name;
end;
$$;

revoke all on function public.ticketing_get_organizer_calendar(timestamptz,timestamptz)
from public, anon;
grant execute on function public.ticketing_get_organizer_calendar(timestamptz,timestamptz)
to authenticated, service_role;

-- Creates a confirmed organizer reservation directly against canonical inventory.
-- It intentionally does not pretend an online payment happened: only an on-site
-- payment may be marked paid by the organizer.
create or replace function public.ticketing_create_organizer_booking(
  p_session_id uuid,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_items jsonb,
  p_booking_source text,
  p_payment_method text,
  p_mark_paid boolean default false,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  actor_user_id uuid := auth.uid();
  session_context record;
  requested_capacity integer;
  reserved_capacity integer;
  subtotal numeric(12,2);
  order_currency text;
  currency_count integer;
  item_count integer;
  distinct_item_count integer;
  new_order_id uuid;
  new_order_number bigint;
  resolved_name text;
  resolved_email text;
  operation_time timestamptz := clock_timestamp();
begin
  if actor_user_id is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if p_session_id is null
     or p_booking_source not in ('manual','walk_in')
     or p_payment_method <> 'on_site'
     or p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) < 1
     or jsonb_array_length(p_items) > 20 then
    raise exception 'Invalid organizer booking data' using errcode = '22023';
  end if;

  if p_note is not null and char_length(p_note) > 1000 then
    raise exception 'Booking note is too long' using errcode = '22023';
  end if;

  if p_mark_paid and p_payment_method <> 'on_site' then
    raise exception 'Only an on-site payment can be marked paid manually'
      using errcode = '22023';
  end if;

  resolved_name := nullif(btrim(coalesce(p_customer_name,'')), '');
  if resolved_name is null and p_booking_source = 'walk_in' then
    resolved_name := 'Klient walk-in';
  end if;
  if resolved_name is null or char_length(resolved_name) not between 2 and 160 then
    raise exception 'Customer name is required for a manual reservation'
      using errcode = '22023';
  end if;

  resolved_email := nullif(lower(btrim(coalesce(p_customer_email,''))), '');
  if resolved_email is not null and (
    char_length(resolved_email) > 254 or position('@' in resolved_email) <= 1
  ) then
    raise exception 'Customer email is invalid' using errcode = '22023';
  end if;
  if p_payment_method = 'online' and resolved_email is null then
    raise exception 'Online payment requires customer email' using errcode = '22023';
  end if;

  select
    s.id as session_id,
    s.capacity,
    s.starts_at,
    s.ends_at,
    s.status as session_status,
    p.id as product_id,
    p.name as product_name,
    p.min_participants,
    p.max_participants,
    p.status as product_status,
    v.id as venue_id,
    v.organization_id,
    v.status as venue_status
  into session_context
  from public.sessions s
  join public.products p on p.id = s.product_id
  join public.venues v on v.id = p.venue_id
  where s.id = p_session_id
  for update of s;

  if not found then
    raise exception 'Session does not exist' using errcode = 'P0002';
  end if;

  if not public.ticketing_is_org_member(
    session_context.organization_id,
    array['owner','admin','manager']::public.ticketing_member_role[]
  ) then
    raise exception 'User cannot create bookings for this organization'
      using errcode = '42501';
  end if;

  if session_context.session_status <> 'scheduled'
     or session_context.product_status <> 'active'
     or session_context.venue_status <> 'active'
     or session_context.ends_at <= operation_time then
    raise exception 'Session is not available for organizer booking'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) item
    where jsonb_typeof(item) <> 'object'
      or coalesce(item ->> 'ticket_type_id','')
        !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or coalesce(item ->> 'quantity','') !~ '^[1-9][0-9]*$'
  ) then
    raise exception 'Every booking item needs a ticket type and quantity'
      using errcode = '22023';
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
    raise exception 'A ticket type may appear only once'
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
    from requested r
    left join public.ticket_types t on t.id = r.ticket_type_id
    where t.id is null
      or t.product_id <> session_context.product_id
      or not t.is_active
      or r.quantity < t.min_quantity_per_order
      or (t.max_quantity_per_order is not null and r.quantity > t.max_quantity_per_order)
  ) then
    raise exception 'Booking contains an unavailable ticket type or invalid quantity'
      using errcode = '22023';
  end if;

  with requested as (
    select
      (item ->> 'ticket_type_id')::uuid as ticket_type_id,
      (item ->> 'quantity')::integer as quantity
    from jsonb_array_elements(p_items) item
  )
  select
    sum(r.quantity * t.capacity_units)::integer,
    sum(r.quantity * t.price_amount)::numeric(12,2),
    min(t.currency),
    count(distinct t.currency)::integer
  into requested_capacity, subtotal, order_currency, currency_count
  from requested r
  join public.ticket_types t on t.id = r.ticket_type_id;

  if currency_count <> 1 then
    raise exception 'All booking items must use one currency'
      using errcode = '22023';
  end if;

  if requested_capacity < session_context.min_participants
     or (
       session_context.max_participants is not null
       and requested_capacity > session_context.max_participants
     ) then
    raise exception 'Participant count is outside product limits'
      using errcode = '22023';
  end if;

  select coalesce(sum(h.capacity_units) filter (
    where h.status = 'converted'
      or (h.status = 'active' and h.expires_at > operation_time)
  ), 0)::integer
  into reserved_capacity
  from public.inventory_holds h
  where h.session_id = p_session_id;

  if requested_capacity > session_context.capacity - reserved_capacity then
    raise exception 'Insufficient capacity: requested %, available %',
      requested_capacity,
      greatest(session_context.capacity - reserved_capacity, 0)
      using errcode = 'P0001';
  end if;

  insert into public.orders (
    organization_id,
    venue_id,
    customer_name,
    customer_email,
    customer_phone,
    source,
    booking_source,
    payment_method,
    status,
    payment_status,
    currency,
    subtotal_amount,
    discount_amount,
    total_amount,
    confirmed_at,
    metadata
  ) values (
    session_context.organization_id,
    session_context.venue_id,
    resolved_name,
    resolved_email,
    nullif(btrim(coalesce(p_customer_phone,'')), ''),
    'box_office',
    p_booking_source,
    p_payment_method,
    'confirmed',
    case when p_mark_paid then 'paid'::public.ticketing_payment_status else 'unpaid'::public.ticketing_payment_status end,
    order_currency,
    subtotal,
    0,
    subtotal,
    operation_time,
    jsonb_strip_nulls(jsonb_build_object(
      'organizer_created_by', actor_user_id,
      'organizer_note', nullif(btrim(coalesce(p_note,'')), ''),
      'operations_version', 'p0'
    ))
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
    t.id,
    session_context.product_name,
    t.name,
    r.quantity,
    t.capacity_units,
    t.price_amount,
    r.quantity * t.price_amount
  from requested r
  join public.ticket_types t on t.id = r.ticket_type_id;

  insert into public.inventory_holds (
    session_id,
    order_id,
    capacity_units,
    status,
    expires_at,
    converted_at
  ) values (
    p_session_id,
    new_order_id,
    requested_capacity,
    'converted',
    operation_time + interval '30 minutes',
    operation_time
  );

  insert into public.tickets (
    order_id,
    order_item_id,
    sequence_number,
    metadata
  )
  select
    item.order_id,
    item.id,
    generated.sequence_number,
    jsonb_build_object(
      'issued_by', 'organizer',
      'issued_by_user_id', actor_user_id
    )
  from public.order_items item
  cross join lateral generate_series(1, item.quantity) generated(sequence_number)
  where item.order_id = new_order_id
  on conflict (order_item_id, sequence_number) do nothing;

  return jsonb_build_object(
    'orderId', new_order_id,
    'orderNumber', new_order_number,
    'availableCapacity', session_context.capacity - reserved_capacity - requested_capacity
  );
end;
$$;

revoke all on function public.ticketing_create_organizer_booking(
  uuid,text,text,text,jsonb,text,text,boolean,text
) from public, anon;
grant execute on function public.ticketing_create_organizer_booking(
  uuid,text,text,text,jsonb,text,text,boolean,text
) to authenticated, service_role;

create or replace function public.ticketing_mark_on_site_payment_paid(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  actor_user_id uuid := auth.uid();
  order_row public.orders%rowtype;
  paid_time timestamptz := clock_timestamp();
begin
  if actor_user_id is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  select * into order_row
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order does not exist' using errcode = 'P0002';
  end if;

  if not public.ticketing_is_org_member(
    order_row.organization_id,
    array['owner','admin','manager']::public.ticketing_member_role[]
  ) then
    raise exception 'User cannot settle this booking' using errcode = '42501';
  end if;

  if order_row.payment_method <> 'on_site' then
    raise exception 'Only on-site payments may be settled manually'
      using errcode = 'P0001';
  end if;

  if order_row.payment_status = 'paid' then
    return jsonb_build_object('orderId', order_row.id, 'paymentStatus', 'paid');
  end if;

  if order_row.status <> 'confirmed'
     or order_row.payment_status not in ('unpaid','pending') then
    raise exception 'Booking cannot be marked paid in its current state'
      using errcode = 'P0001';
  end if;

  update public.orders
  set payment_status = 'paid',
      metadata = metadata || jsonb_build_object(
        'on_site_payment',
        jsonb_build_object('paid_at', paid_time, 'recorded_by', actor_user_id)
      )
  where id = p_order_id;

  return jsonb_build_object('orderId', p_order_id, 'paymentStatus', 'paid');
end;
$$;

revoke all on function public.ticketing_mark_on_site_payment_paid(uuid)
from public, anon;
grant execute on function public.ticketing_mark_on_site_payment_paid(uuid)
to authenticated, service_role;

create or replace function public.ticketing_reschedule_organizer_booking(
  p_order_id uuid,
  p_to_session_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  actor_user_id uuid := auth.uid();
  order_row public.orders%rowtype;
  current_session_id uuid;
  current_product_id uuid;
  session_count integer;
  product_count integer;
  requested_capacity integer;
  target_context record;
  reserved_capacity integer;
  change_time timestamptz := clock_timestamp();
begin
  if actor_user_id is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;
  if p_order_id is null or p_to_session_id is null then
    raise exception 'Order and target session are required' using errcode = '22023';
  end if;
  if p_reason is not null and char_length(p_reason) > 500 then
    raise exception 'Reschedule reason is too long' using errcode = '22023';
  end if;

  select * into order_row
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order does not exist' using errcode = 'P0002';
  end if;

  if not public.ticketing_is_org_member(
    order_row.organization_id,
    array['owner','admin','manager']::public.ticketing_member_role[]
  ) then
    raise exception 'User cannot reschedule this booking' using errcode = '42501';
  end if;

  if order_row.status <> 'confirmed' then
    raise exception 'Only confirmed bookings can be rescheduled'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.tickets
    where order_id = p_order_id and status = 'used'
  ) then
    raise exception 'A booking with used tickets cannot be rescheduled'
      using errcode = 'P0001';
  end if;

  select
    count(distinct item.session_id)::integer,
    count(distinct item.product_id)::integer,
    sum(item.quantity * item.capacity_units_each)::integer
  into
    session_count,
    product_count,
    requested_capacity
  from public.order_items item
  where item.order_id = p_order_id;

  if session_count <> 1 or product_count <> 1 then
    raise exception 'This order is not a single-session booking'
      using errcode = 'P0001';
  end if;

  select item.session_id, item.product_id
  into current_session_id, current_product_id
  from public.order_items item
  where item.order_id = p_order_id
  order by item.created_at, item.id
  limit 1;

  if current_session_id is null or current_product_id is null then
    raise exception 'Booking has no order items' using errcode = 'P0001';
  end if;

  if current_session_id = p_to_session_id then
    return jsonb_build_object(
      'orderId', p_order_id,
      'fromSessionId', current_session_id,
      'toSessionId', p_to_session_id,
      'changed', false
    );
  end if;

  -- Deterministic locks prevent cross-session reschedules from deadlocking.
  perform 1
  from public.sessions
  where id in (current_session_id, p_to_session_id)
  order by id
  for update;

  select
    s.id,
    s.product_id,
    s.capacity,
    s.starts_at,
    s.ends_at,
    s.status,
    p.venue_id,
    v.organization_id
  into target_context
  from public.sessions s
  join public.products p on p.id = s.product_id
  join public.venues v on v.id = p.venue_id
  where s.id = p_to_session_id;

  if not found then
    raise exception 'Target session does not exist' using errcode = 'P0002';
  end if;

  if target_context.product_id <> current_product_id
     or target_context.organization_id <> order_row.organization_id
     or target_context.status <> 'scheduled'
     or target_context.ends_at <= change_time then
    raise exception 'Target session is not compatible with this booking'
      using errcode = 'P0001';
  end if;

  select coalesce(sum(h.capacity_units) filter (
    where h.order_id is distinct from p_order_id
      and (
        h.status = 'converted'
        or (h.status = 'active' and h.expires_at > change_time)
      )
  ), 0)::integer
  into reserved_capacity
  from public.inventory_holds h
  where h.session_id = p_to_session_id;

  if requested_capacity > target_context.capacity - reserved_capacity then
    raise exception 'Insufficient capacity for reschedule'
      using errcode = 'P0001';
  end if;

  update public.inventory_holds
  set session_id = p_to_session_id
  where order_id = p_order_id
    and session_id = current_session_id
    and status in ('active','converted');

  update public.order_items
  set session_id = p_to_session_id
  where order_id = p_order_id
    and session_id = current_session_id;

  insert into public.booking_reschedules (
    order_id,
    from_session_id,
    to_session_id,
    changed_by,
    reason
  ) values (
    p_order_id,
    current_session_id,
    p_to_session_id,
    actor_user_id,
    nullif(btrim(coalesce(p_reason,'')), '')
  );

  update public.orders
  set metadata = metadata || jsonb_build_object(
    'last_reschedule',
    jsonb_build_object(
      'from_session_id', current_session_id,
      'to_session_id', p_to_session_id,
      'changed_by', actor_user_id,
      'changed_at', change_time
    )
  )
  where id = p_order_id;

  return jsonb_build_object(
    'orderId', p_order_id,
    'fromSessionId', current_session_id,
    'toSessionId', p_to_session_id,
    'changed', true
  );
end;
$$;

revoke all on function public.ticketing_reschedule_organizer_booking(uuid,uuid,text)
from public, anon;
grant execute on function public.ticketing_reschedule_organizer_booking(uuid,uuid,text)
to authenticated, service_role;

-- Extend organizer lifecycle with operational metadata and stable IDs required
-- by the reschedule UI.
create or replace function public.ticketing_get_organizer_order_lifecycle(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
stable
as $$
declare
  actor_user_id uuid := auth.uid();
  order_row public.orders%rowtype;
  venue_row public.venues%rowtype;
  result jsonb;
begin
  if actor_user_id is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  select * into order_row
  from public.orders
  where id = p_order_id;

  if not found then
    raise exception 'Order does not exist' using errcode = 'P0002';
  end if;

  if not public.ticketing_is_org_member(
    order_row.organization_id,
    array['owner','admin','manager','viewer']::public.ticketing_member_role[]
  ) then
    raise exception 'User cannot view this order' using errcode = '42501';
  end if;

  select * into venue_row from public.venues where id = order_row.venue_id;

  result := jsonb_build_object(
    'order', jsonb_build_object(
      'id', order_row.id,
      'orderNumber', order_row.order_number,
      'organizationId', order_row.organization_id,
      'status', order_row.status,
      'paymentStatus', order_row.payment_status,
      'paymentMethod', order_row.payment_method,
      'bookingSource', order_row.booking_source,
      'customerName', order_row.customer_name,
      'customerEmail', order_row.customer_email,
      'customerPhone', order_row.customer_phone,
      'currency', order_row.currency,
      'subtotalAmount', order_row.subtotal_amount,
      'discountAmount', order_row.discount_amount,
      'totalAmount', order_row.total_amount,
      'createdAt', order_row.created_at,
      'expiresAt', order_row.expires_at,
      'confirmedAt', order_row.confirmed_at,
      'cancelledAt', order_row.cancelled_at,
      'source', order_row.source,
      'venue', jsonb_build_object(
        'id', venue_row.id,
        'name', venue_row.name,
        'city', venue_row.city,
        'timezone', venue_row.timezone
      )
    ),
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', item.id,
          'productId', item.product_id,
          'sessionId', item.session_id,
          'productName', item.product_name,
          'ticketTypeName', item.ticket_type_name,
          'quantity', item.quantity,
          'capacityUnitsEach', item.capacity_units_each,
          'unitPriceAmount', item.unit_price_amount,
          'totalPriceAmount', item.total_price_amount,
          'startsAt', session.starts_at,
          'endsAt', session.ends_at
        ) order by item.created_at, item.id
      )
      from public.order_items item
      join public.sessions session on session.id = item.session_id
      where item.order_id = order_row.id
    ), '[]'::jsonb),
    'tickets', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', ticket.id,
          'ticketCode', ticket.ticket_code,
          'sequenceNumber', ticket.sequence_number,
          'status', ticket.status,
          'issuedAt', ticket.issued_at,
          'usedAt', ticket.used_at,
          'usedBy', case when ticket.used_by is null then null else jsonb_build_object(
            'id', ticket.used_by,
            'name', coalesce(
              nullif(btrim(profile.full_name), ''),
              nullif(auth_user.raw_user_meta_data->>'full_name', ''),
              split_part(auth_user.email, '@', 1)
            )
          ) end,
          'productName', item.product_name,
          'ticketTypeName', item.ticket_type_name
        ) order by ticket.sequence_number, ticket.id
      )
      from public.tickets ticket
      join public.order_items item on item.id = ticket.order_item_id
      left join auth.users auth_user on auth_user.id = ticket.used_by
      left join public.users profile on profile.id = ticket.used_by
      where ticket.order_id = order_row.id
    ), '[]'::jsonb),
    'paymentAttempts', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', attempt.id,
          'provider', attempt.provider,
          'status', attempt.status,
          'failureCode', attempt.failure_code,
          'createdAt', attempt.created_at,
          'updatedAt', attempt.updated_at
        ) order by attempt.created_at, attempt.id
      )
      from public.payment_attempts attempt
      where attempt.order_id = order_row.id
    ), '[]'::jsonb),
    'reschedules', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', r.id,
          'fromSessionId', r.from_session_id,
          'toSessionId', r.to_session_id,
          'reason', r.reason,
          'createdAt', r.created_at
        ) order by r.created_at desc
      )
      from public.booking_reschedules r
      where r.order_id = order_row.id
    ), '[]'::jsonb)
  );

  return result;
end;
$$;

revoke all on function public.ticketing_get_organizer_order_lifecycle(uuid)
from public, anon;
grant execute on function public.ticketing_get_organizer_order_lifecycle(uuid)
to authenticated, service_role;

commit;
