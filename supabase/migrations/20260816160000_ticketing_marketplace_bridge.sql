-- EnjoyHubAI ticketing marketplace bridge - stage 2B
--
-- Public properties remain the discovery/content model. A property can now be
-- linked explicitly to one canonical ticketing venue. All public availability
-- is read from materialized sessions and atomic inventory holds.

begin;

alter table public.venues
  add column if not exists property_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'venues_property_id_fkey'
      and conrelid = 'public.venues'::regclass
  ) then
    alter table public.venues
      add constraint venues_property_id_fkey
      foreign key (property_id)
      references public.properties(id)
      on delete set null;
  end if;
end
$$;

create unique index if not exists venues_property_id_unique_idx
  on public.venues(property_id)
  where property_id is not null;

comment on column public.venues.property_id is
  'Optional one-to-one link to the public marketplace property shown on EnjoyHub.';

-- Customers keep access to the venue and session snapshots referenced by their
-- own orders, even after a session is completed or a venue is archived. This
-- keeps the canonical dashboard useful as purchase history without exposing
-- records belonging to other customers.
drop policy if exists venues_select_order_customers on public.venues;
create policy venues_select_order_customers
on public.venues for select to authenticated
using (
  exists (
    select 1
    from public.orders customer_order
    where customer_order.venue_id = venues.id
      and customer_order.customer_user_id = auth.uid()
  )
);

drop policy if exists sessions_select_order_customers on public.sessions;
create policy sessions_select_order_customers
on public.sessions for select to authenticated
using (
  exists (
    select 1
    from public.order_items item
    join public.orders customer_order on customer_order.id = item.order_id
    where item.session_id = sessions.id
      and customer_order.customer_user_id = auth.uid()
  )
);

-- The marketplace link is writable only through the validated security-definer
-- function below. Normal managers retain the venue fields they already edit.
revoke insert, update on public.venues from authenticated;
grant insert (
  organization_id,
  name,
  slug,
  description,
  address_line_1,
  address_line_2,
  postal_code,
  city,
  country_code,
  latitude,
  longitude,
  timezone,
  default_currency,
  sales_mode,
  status,
  created_by
) on public.venues to authenticated;
grant update (
  name,
  slug,
  description,
  address_line_1,
  address_line_2,
  postal_code,
  city,
  country_code,
  latitude,
  longitude,
  timezone,
  default_currency,
  sales_mode,
  status
) on public.venues to authenticated;

-- Conservatively connect existing records only when the creator owns exactly
-- one active property with the same normalized name and city.
with candidates as (
  select
    venue.id as venue_id,
    property.id as property_id,
    count(*) over (partition by venue.id) as venue_match_count,
    count(*) over (partition by property.id) as property_match_count
  from public.venues venue
  join public.properties property
    on property.host_id = venue.created_by
   and lower(btrim(property.title)) = lower(btrim(venue.name))
   and lower(btrim(property.city)) = lower(btrim(coalesce(venue.city, '')))
   and property.is_active = true
  where venue.property_id is null
), unique_candidates as (
  select venue_id, property_id
  from candidates
  where venue_match_count = 1
    and property_match_count = 1
)
update public.venues venue
   set property_id = candidate.property_id
  from unique_candidates candidate
 where venue.id = candidate.venue_id
   and venue.property_id is null
   and not exists (
     select 1
     from public.venues occupied
     where occupied.property_id = candidate.property_id
   );

create or replace function public.ticketing_link_venue_property(
  p_venue_id uuid,
  p_property_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_user_id uuid := auth.uid();
begin
  if actor_user_id is null then
    raise exception 'Authentication is required to link a marketplace property'
      using errcode = '42501';
  end if;

  if p_venue_id is null or p_property_id is null then
    raise exception 'Venue and property are required'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.venues venue
    join public.organization_memberships membership
      on membership.organization_id = venue.organization_id
     and membership.user_id = actor_user_id
     and membership.role in ('owner', 'admin', 'manager')
    where venue.id = p_venue_id
      and venue.status not in ('suspended', 'archived')
  ) then
    raise exception 'You cannot link this venue'
      using errcode = '42501';
  end if;

  -- A manager may keep an existing link while creating another product even
  -- when the marketplace property belongs to the organization owner.
  if exists (
    select 1
    from public.venues venue
    where venue.id = p_venue_id
      and venue.property_id = p_property_id
  ) then
    return p_venue_id;
  end if;

  if not exists (
    select 1
    from public.properties property
    where property.id = p_property_id
      and property.host_id = actor_user_id
      and property.is_active = true
  ) then
    raise exception 'You cannot link this marketplace property'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.venues venue
    where venue.property_id = p_property_id
      and venue.id <> p_venue_id
  ) then
    raise exception 'Marketplace property is already linked to another venue'
      using errcode = '23505';
  end if;

  update public.venues
     set property_id = p_property_id
   where id = p_venue_id;

  return p_venue_id;
end;
$$;

create or replace function public.ticketing_create_marketplace_sales_setup(
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
  p_generate_until date,
  p_property_id uuid
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
  setup_result record;
begin
  select *
    into setup_result
    from public.ticketing_create_sales_setup(
      p_organization_id,
      p_existing_venue_id,
      p_organization_name,
      p_venue_name,
      p_venue_slug,
      p_venue_description,
      p_address_line_1,
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

  if p_property_id is not null then
    perform public.ticketing_link_venue_property(
      setup_result.created_venue_id,
      p_property_id
    );
  end if;

  return query select
    setup_result.created_organization_id,
    setup_result.created_venue_id,
    setup_result.created_product_id,
    setup_result.generated_session_count;
end;
$$;

create or replace function public.ticketing_list_property_sessions(
  p_property_id uuid,
  p_start_date date,
  p_end_date date
)
returns table (
  session_id uuid,
  product_id uuid,
  product_name text,
  starts_at timestamptz,
  ends_at timestamptz,
  local_date date,
  local_start_time text,
  local_end_time text,
  available_capacity_units integer,
  price_from numeric(12, 2),
  currency text,
  venue_timezone text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if p_property_id is null or p_start_date is null or p_end_date is null then
    raise exception 'Property and date range are required'
      using errcode = '22023';
  end if;

  if p_end_date < p_start_date or p_end_date - p_start_date > 92 then
    raise exception 'Marketplace calendar range must contain at most 93 days'
      using errcode = '22023';
  end if;

  return query
  select
    session.id,
    product.id,
    product.name,
    session.starts_at,
    session.ends_at,
    (session.starts_at at time zone venue.timezone)::date,
    to_char(session.starts_at at time zone venue.timezone, 'HH24:MI'),
    to_char(session.ends_at at time zone venue.timezone, 'HH24:MI'),
    greatest(session.capacity - inventory.reserved_capacity, 0)::integer,
    price.price_amount,
    price.currency,
    venue.timezone
  from public.venues venue
  join public.properties property
    on property.id = venue.property_id
   and property.is_active = true
  join public.products product
    on product.venue_id = venue.id
   and product.status = 'active'
   and product.inventory_mode in ('native_enjoyhub', 'allocated_quota')
  join public.sessions session
    on session.product_id = product.id
   and session.status = 'scheduled'
  join lateral (
    select ticket.price_amount, ticket.currency
    from public.ticket_types ticket
    where ticket.product_id = product.id
      and ticket.is_active = true
    order by ticket.price_amount, ticket.sort_order, ticket.id
    limit 1
  ) price on true
  left join lateral (
    select coalesce(sum(hold.capacity_units) filter (
      where hold.status = 'converted'
         or (hold.status = 'active' and hold.expires_at > now())
    ), 0)::integer as reserved_capacity
    from public.inventory_holds hold
    where hold.session_id = session.id
  ) inventory on true
  where venue.property_id = p_property_id
    and venue.status = 'active'
    and session.starts_at >= (p_start_date::timestamp at time zone venue.timezone)
    and session.starts_at < ((p_end_date + 1)::timestamp at time zone venue.timezone)
    and (session.starts_at at time zone venue.timezone)::date
      between p_start_date and p_end_date
    and now() < session.starts_at
    and (session.sales_starts_at is null or session.sales_starts_at <= now())
    and (session.sales_ends_at is null or session.sales_ends_at > now())
    and now() <= session.starts_at
      - make_interval(mins => product.booking_notice_minutes)
    and session.capacity > inventory.reserved_capacity
  order by session.starts_at, product.name;
end;
$$;

revoke all on function public.ticketing_link_venue_property(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.ticketing_create_marketplace_sales_setup(
  uuid, uuid, text, text, text, text, text, text, text,
  public.ticketing_sales_mode, text, text, text, integer, jsonb,
  smallint[], time, time, integer, integer, integer, date, uuid
) from public, anon, authenticated;
revoke all on function public.ticketing_list_property_sessions(uuid, date, date)
  from public, anon, authenticated;

grant execute on function public.ticketing_link_venue_property(uuid, uuid)
  to authenticated, service_role;
grant execute on function public.ticketing_create_marketplace_sales_setup(
  uuid, uuid, text, text, text, text, text, text, text,
  public.ticketing_sales_mode, text, text, text, integer, jsonb,
  smallint[], time, time, integer, integer, integer, date, uuid
) to authenticated, service_role;
grant execute on function public.ticketing_list_property_sessions(uuid, date, date)
  to anon, authenticated, service_role;

comment on function public.ticketing_list_property_sessions(uuid, date, date) is
  'Returns live, sellable ticketing sessions for one public marketplace property.';

commit;
