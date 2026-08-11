-- EnjoyHubAI ticketing core - stage 1A
--
-- This migration is intentionally additive. It does not rename, mutate, copy or
-- delete the legacy properties, offers, bookings, offer_bookings or availability
-- tables. The application can therefore continue to use the legacy model while
-- the canonical ticketing flow is implemented and tested.

begin;

-- ---------------------------------------------------------------------------
-- Domain types
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'ticketing_organization_status'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.ticketing_organization_status as enum (
      'active',
      'suspended'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'ticketing_member_role'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.ticketing_member_role as enum (
      'owner',
      'admin',
      'manager',
      'cashier',
      'viewer'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'ticketing_venue_status'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.ticketing_venue_status as enum (
      'draft',
      'active',
      'suspended',
      'archived'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'ticketing_sales_mode'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.ticketing_sales_mode as enum (
      'native_enjoyhub',
      'allocated_quota',
      'external_api',
      'redirect'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'ticketing_product_status'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.ticketing_product_status as enum (
      'draft',
      'active',
      'archived'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'ticketing_session_status'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.ticketing_session_status as enum (
      'scheduled',
      'sold_out',
      'cancelled',
      'completed'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'ticketing_order_status'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.ticketing_order_status as enum (
      'draft',
      'awaiting_payment',
      'confirmed',
      'cancelled',
      'expired',
      'partially_refunded',
      'refunded'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'ticketing_payment_status'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.ticketing_payment_status as enum (
      'not_required',
      'unpaid',
      'pending',
      'paid',
      'failed',
      'partially_refunded',
      'refunded'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'ticketing_order_source'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.ticketing_order_source as enum (
      'enjoyhub_marketplace',
      'venue_widget',
      'box_office',
      'phone',
      'integration'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'ticketing_hold_status'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.ticketing_hold_status as enum (
      'active',
      'converted',
      'released',
      'expired'
    );
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Organizations and staff
-- ---------------------------------------------------------------------------

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 160),
  legal_name text,
  tax_id text,
  billing_email text,
  status public.ticketing_organization_status not null default 'active',
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_memberships (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.ticketing_member_role not null default 'viewer',
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create index organization_memberships_user_id_idx
  on public.organization_memberships(user_id);

-- ---------------------------------------------------------------------------
-- Venues and sellable products
-- ---------------------------------------------------------------------------

create table public.venues (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 2 and 160),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text,
  address_line_1 text,
  address_line_2 text,
  postal_code text,
  city text,
  country_code text not null default 'PL' check (country_code ~ '^[A-Z]{2}$'),
  latitude numeric(9, 6) check (latitude between -90 and 90),
  longitude numeric(9, 6) check (longitude between -180 and 180),
  timezone text not null default 'Europe/Warsaw',
  default_currency text not null default 'PLN' check (default_currency ~ '^[A-Z]{3}$'),
  sales_mode public.ticketing_sales_mode not null default 'allocated_quota',
  status public.ticketing_venue_status not null default 'draft',
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create index venues_organization_id_idx on public.venues(organization_id);
create index venues_public_status_idx on public.venues(status) where status = 'active';

create table public.products (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 2 and 180),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text,
  duration_minutes integer not null check (duration_minutes between 1 and 1440),
  min_participants integer not null default 1 check (min_participants > 0),
  max_participants integer check (
    max_participants is null or max_participants >= min_participants
  ),
  booking_notice_minutes integer not null default 0 check (booking_notice_minutes >= 0),
  inventory_mode public.ticketing_sales_mode not null default 'allocated_quota',
  includes text[] not null default '{}',
  restrictions jsonb not null default '{}'::jsonb check (jsonb_typeof(restrictions) = 'object'),
  arrival_instructions text,
  cancellation_policy text,
  status public.ticketing_product_status not null default 'draft',
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (venue_id, slug),
  unique (id, venue_id)
);

create index products_venue_id_idx on public.products(venue_id);
create index products_public_status_idx on public.products(status) where status = 'active';

create table public.ticket_types (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  description text,
  price_amount numeric(12, 2) not null check (price_amount >= 0),
  currency text not null default 'PLN' check (currency ~ '^[A-Z]{3}$'),
  capacity_units integer not null default 1 check (capacity_units > 0),
  min_quantity_per_order integer not null default 1 check (min_quantity_per_order > 0),
  max_quantity_per_order integer check (
    max_quantity_per_order is null
    or max_quantity_per_order >= min_quantity_per_order
  ),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, name),
  unique (id, product_id)
);

create index ticket_types_product_id_idx on public.ticket_types(product_id);

-- A schedule is a local-time template. Actual inventory always lives in sessions.
create table public.product_schedules (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  weekday smallint not null check (weekday between 1 and 7),
  local_start_time time not null,
  local_end_time time not null,
  slot_interval_minutes integer not null check (slot_interval_minutes between 1 and 1440),
  capacity integer not null check (capacity > 0),
  valid_from date not null,
  valid_until date,
  sales_cutoff_minutes integer not null default 0 check (sales_cutoff_minutes >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (local_end_time > local_start_time),
  check (valid_until is null or valid_until >= valid_from),
  unique (product_id, weekday, local_start_time, valid_from)
);

create index product_schedules_product_id_idx on public.product_schedules(product_id);

-- Exceptions are attached to a single recurring schedule, allowing multiple
-- independent opening windows on the same day.
create table public.product_schedule_exceptions (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.product_schedules(id) on delete cascade,
  local_date date not null,
  is_closed boolean not null default false,
  local_start_time time,
  local_end_time time,
  capacity integer check (capacity is null or capacity > 0),
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (schedule_id, local_date),
  check (
    (local_start_time is null and local_end_time is null)
    or (local_start_time is not null and local_end_time is not null and local_end_time > local_start_time)
  ),
  check (
    (is_closed and local_start_time is null and local_end_time is null and capacity is null)
    or (not is_closed and (local_start_time is not null or capacity is not null))
  )
);

create index product_schedule_exceptions_date_idx
  on public.product_schedule_exceptions(local_date);

-- Session timestamps are stored as timestamptz (UTC internally). The venue's
-- IANA timezone controls local display and schedule generation.
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  schedule_id uuid references public.product_schedules(id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity integer not null check (capacity > 0),
  sales_starts_at timestamptz,
  sales_ends_at timestamptz,
  status public.ticketing_session_status not null default 'scheduled',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (sales_starts_at is null or sales_starts_at < starts_at),
  check (sales_ends_at is null or sales_ends_at <= starts_at),
  check (
    sales_starts_at is null
    or sales_ends_at is null
    or sales_ends_at > sales_starts_at
  ),
  unique (product_id, starts_at),
  unique (id, product_id)
);

create index sessions_product_starts_at_idx on public.sessions(product_id, starts_at);
create index sessions_sellable_idx
  on public.sessions(starts_at, product_id)
  where status = 'scheduled';

-- ---------------------------------------------------------------------------
-- Orders and inventory holds
-- ---------------------------------------------------------------------------

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated by default as identity unique,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  venue_id uuid not null references public.venues(id) on delete restrict,
  customer_user_id uuid references auth.users(id) on delete set null,
  customer_name text not null check (char_length(btrim(customer_name)) between 2 and 160),
  customer_email text not null,
  customer_phone text,
  source public.ticketing_order_source not null default 'enjoyhub_marketplace',
  status public.ticketing_order_status not null default 'draft',
  payment_status public.ticketing_payment_status not null default 'unpaid',
  currency text not null default 'PLN' check (currency ~ '^[A-Z]{3}$'),
  subtotal_amount numeric(12, 2) not null default 0 check (subtotal_amount >= 0),
  discount_amount numeric(12, 2) not null default 0 check (discount_amount >= 0),
  total_amount numeric(12, 2) not null default 0 check (total_amount >= 0),
  expires_at timestamptz,
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  terms_accepted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (discount_amount <= subtotal_amount),
  check (total_amount = subtotal_amount - discount_amount)
);

create index orders_customer_user_id_idx on public.orders(customer_user_id);
create index orders_venue_created_at_idx on public.orders(venue_id, created_at desc);
create index orders_status_idx on public.orders(status);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  session_id uuid not null references public.sessions(id) on delete restrict,
  ticket_type_id uuid not null references public.ticket_types(id) on delete restrict,
  product_name text not null,
  ticket_type_name text not null,
  quantity integer not null check (quantity > 0),
  capacity_units_each integer not null check (capacity_units_each > 0),
  unit_price_amount numeric(12, 2) not null check (unit_price_amount >= 0),
  total_price_amount numeric(12, 2) not null check (total_price_amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (total_price_amount = quantity * unit_price_amount)
);

create index order_items_order_id_idx on public.order_items(order_id);
create index order_items_session_id_idx on public.order_items(session_id);

create table public.inventory_holds (
  id uuid primary key default gen_random_uuid(),
  hold_token uuid not null default gen_random_uuid() unique,
  session_id uuid not null references public.sessions(id) on delete restrict,
  order_id uuid references public.orders(id) on delete restrict,
  capacity_units integer not null check (capacity_units > 0),
  status public.ticketing_hold_status not null default 'active',
  expires_at timestamptz not null,
  converted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, session_id),
  check (expires_at > created_at),
  check (
    (status = 'converted' and converted_at is not null)
    or (status <> 'converted')
  )
);

create index inventory_holds_session_active_idx
  on public.inventory_holds(session_id, expires_at)
  where status = 'active';

-- ---------------------------------------------------------------------------
-- Integrity and lifecycle helpers
-- ---------------------------------------------------------------------------

create or replace function public.ticketing_set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.ticketing_validate_venue_timezone()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from pg_catalog.pg_timezone_names where name = new.timezone
  ) then
    raise exception 'Unknown IANA timezone: %', new.timezone
      using errcode = '22023';
  end if;

  return new;
end;
$$;

create or replace function public.ticketing_add_organization_owner()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.organization_memberships (
    organization_id,
    user_id,
    role,
    invited_by
  ) values (
    new.id,
    new.created_by,
    'owner',
    new.created_by
  );

  return new;
end;
$$;

create or replace function public.ticketing_keep_organization_owner()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.role = 'owner' then
    if tg_op = 'DELETE' then
      if not exists (
        select 1
        from public.organization_memberships
        where organization_id = old.organization_id
          and user_id <> old.user_id
          and role = 'owner'
      ) then
        raise exception 'An organization must have at least one owner'
          using errcode = '23514';
      end if;
    elsif new.role <> 'owner' and not exists (
      select 1
      from public.organization_memberships
      where organization_id = old.organization_id
        and user_id <> old.user_id
        and role = 'owner'
    ) then
      raise exception 'An organization must have at least one owner'
        using errcode = '23514';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create or replace function public.ticketing_validate_order_scope()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  venue_organization_id uuid;
begin
  select organization_id
    into venue_organization_id
    from public.venues
   where id = new.venue_id;

  if venue_organization_id is null
     or venue_organization_id <> new.organization_id then
    raise exception 'Order organization and venue do not match'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.ticketing_validate_order_item_scope()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  order_venue_id uuid;
  product_venue_id uuid;
  session_product_id uuid;
  ticket_product_id uuid;
begin
  select venue_id into order_venue_id
    from public.orders where id = new.order_id;
  select venue_id into product_venue_id
    from public.products where id = new.product_id;
  select product_id into session_product_id
    from public.sessions where id = new.session_id;
  select product_id into ticket_product_id
    from public.ticket_types where id = new.ticket_type_id;

  if order_venue_id is null
     or product_venue_id is null
     or session_product_id is null
     or ticket_product_id is null
     or order_venue_id <> product_venue_id
     or session_product_id <> new.product_id
     or ticket_product_id <> new.product_id then
    raise exception 'Order item references do not belong to the same venue and product'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.ticketing_validate_hold_scope()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  session_venue_id uuid;
  order_venue_id uuid;
begin
  if new.order_id is null then
    return new;
  end if;

  select p.venue_id
    into session_venue_id
    from public.sessions s
    join public.products p on p.id = s.product_id
   where s.id = new.session_id;

  select venue_id
    into order_venue_id
    from public.orders
   where id = new.order_id;

  if session_venue_id is null
     or order_venue_id is null
     or session_venue_id <> order_venue_id then
    raise exception 'Inventory hold and order must belong to the same venue'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger ticketing_venues_validate_timezone
before insert or update of timezone on public.venues
for each row execute function public.ticketing_validate_venue_timezone();

create trigger ticketing_organizations_add_owner
after insert on public.organizations
for each row execute function public.ticketing_add_organization_owner();

create trigger ticketing_memberships_keep_owner
before delete or update of role on public.organization_memberships
for each row execute function public.ticketing_keep_organization_owner();

create trigger ticketing_orders_validate_scope
before insert or update of organization_id, venue_id on public.orders
for each row execute function public.ticketing_validate_order_scope();

create trigger ticketing_order_items_validate_scope
before insert or update of order_id, product_id, session_id, ticket_type_id
on public.order_items
for each row execute function public.ticketing_validate_order_item_scope();

create trigger ticketing_inventory_holds_validate_scope
before insert or update of session_id, order_id on public.inventory_holds
for each row execute function public.ticketing_validate_hold_scope();

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'organizations',
    'organization_memberships',
    'venues',
    'products',
    'ticket_types',
    'product_schedules',
    'product_schedule_exceptions',
    'sessions',
    'orders',
    'order_items',
    'inventory_holds'
  ] loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.ticketing_set_updated_at()',
      'ticketing_' || table_name || '_updated_at',
      table_name
    );
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

create or replace function public.ticketing_is_org_member(
  target_organization_id uuid,
  allowed_roles public.ticketing_member_role[] default null
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = target_organization_id
      and membership.user_id = auth.uid()
      and (
        allowed_roles is null
        or cardinality(allowed_roles) = 0
        or membership.role = any(allowed_roles)
      )
  );
$$;

create or replace function public.ticketing_is_venue_member(
  target_venue_id uuid,
  allowed_roles public.ticketing_member_role[] default null
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.venues venue
    join public.organization_memberships membership
      on membership.organization_id = venue.organization_id
    where venue.id = target_venue_id
      and membership.user_id = auth.uid()
      and (
        allowed_roles is null
        or cardinality(allowed_roles) = 0
        or membership.role = any(allowed_roles)
      )
  );
$$;

create or replace function public.ticketing_can_read_order(target_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.orders customer_order
    where customer_order.id = target_order_id
      and (
        customer_order.customer_user_id = auth.uid()
        or public.ticketing_is_org_member(customer_order.organization_id)
      )
  );
$$;

revoke all on function public.ticketing_is_org_member(uuid, public.ticketing_member_role[]) from public;
revoke all on function public.ticketing_is_venue_member(uuid, public.ticketing_member_role[]) from public;
revoke all on function public.ticketing_can_read_order(uuid) from public;

grant execute on function public.ticketing_is_org_member(uuid, public.ticketing_member_role[])
  to anon, authenticated, service_role;
grant execute on function public.ticketing_is_venue_member(uuid, public.ticketing_member_role[])
  to anon, authenticated, service_role;
grant execute on function public.ticketing_can_read_order(uuid)
  to authenticated, service_role;

alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.venues enable row level security;
alter table public.products enable row level security;
alter table public.ticket_types enable row level security;
alter table public.product_schedules enable row level security;
alter table public.product_schedule_exceptions enable row level security;
alter table public.sessions enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.inventory_holds enable row level security;

create policy organizations_select_members
on public.organizations for select to authenticated
using (public.ticketing_is_org_member(id));

create policy organizations_insert_creator
on public.organizations for insert to authenticated
with check (created_by = auth.uid());

create policy organizations_update_admins
on public.organizations for update to authenticated
using (
  public.ticketing_is_org_member(
    id,
    array['owner', 'admin']::public.ticketing_member_role[]
  )
)
with check (
  public.ticketing_is_org_member(
    id,
    array['owner', 'admin']::public.ticketing_member_role[]
  )
);

create policy memberships_select_self_or_admins
on public.organization_memberships for select to authenticated
using (
  user_id = auth.uid()
  or public.ticketing_is_org_member(
    organization_id,
    array['owner', 'admin']::public.ticketing_member_role[]
  )
);

create policy memberships_insert_admins
on public.organization_memberships for insert to authenticated
with check (
  public.ticketing_is_org_member(
    organization_id,
    case
      when role = 'owner' then array['owner']::public.ticketing_member_role[]
      else array['owner', 'admin']::public.ticketing_member_role[]
    end
  )
);

create policy memberships_update_admins
on public.organization_memberships for update to authenticated
using (
  public.ticketing_is_org_member(
    organization_id,
    case
      when role = 'owner' then array['owner']::public.ticketing_member_role[]
      else array['owner', 'admin']::public.ticketing_member_role[]
    end
  )
)
with check (
  public.ticketing_is_org_member(
    organization_id,
    case
      when role = 'owner' then array['owner']::public.ticketing_member_role[]
      else array['owner', 'admin']::public.ticketing_member_role[]
    end
  )
);

create policy memberships_delete_admins
on public.organization_memberships for delete to authenticated
using (
  public.ticketing_is_org_member(
    organization_id,
    case
      when role = 'owner' then array['owner']::public.ticketing_member_role[]
      else array['owner', 'admin']::public.ticketing_member_role[]
    end
  )
);

create policy venues_select_public_or_members
on public.venues for select to anon, authenticated
using (
  status = 'active'
  or public.ticketing_is_org_member(organization_id)
);

create policy venues_insert_managers
on public.venues for insert to authenticated
with check (
  created_by = auth.uid()
  and public.ticketing_is_org_member(
    organization_id,
    array['owner', 'admin', 'manager']::public.ticketing_member_role[]
  )
);

create policy venues_update_managers
on public.venues for update to authenticated
using (
  public.ticketing_is_org_member(
    organization_id,
    array['owner', 'admin', 'manager']::public.ticketing_member_role[]
  )
)
with check (
  public.ticketing_is_org_member(
    organization_id,
    array['owner', 'admin', 'manager']::public.ticketing_member_role[]
  )
);

create policy products_select_public_or_members
on public.products for select to anon, authenticated
using (
  public.ticketing_is_venue_member(venue_id)
  or (
    status = 'active'
    and exists (
      select 1 from public.venues venue
      where venue.id = venue_id and venue.status = 'active'
    )
  )
);

create policy products_insert_managers
on public.products for insert to authenticated
with check (
  created_by = auth.uid()
  and public.ticketing_is_venue_member(
    venue_id,
    array['owner', 'admin', 'manager']::public.ticketing_member_role[]
  )
);

create policy products_update_managers
on public.products for update to authenticated
using (
  public.ticketing_is_venue_member(
    venue_id,
    array['owner', 'admin', 'manager']::public.ticketing_member_role[]
  )
)
with check (
  public.ticketing_is_venue_member(
    venue_id,
    array['owner', 'admin', 'manager']::public.ticketing_member_role[]
  )
);

create policy ticket_types_select_public_or_members
on public.ticket_types for select to anon, authenticated
using (
  exists (
    select 1
    from public.products product
    join public.venues venue on venue.id = product.venue_id
    where product.id = product_id
      and (
        public.ticketing_is_venue_member(product.venue_id)
        or (is_active and product.status = 'active' and venue.status = 'active')
      )
  )
);

create policy ticket_types_insert_managers
on public.ticket_types for insert to authenticated
with check (
  exists (
    select 1 from public.products product
    where product.id = product_id
      and public.ticketing_is_venue_member(
        product.venue_id,
        array['owner', 'admin', 'manager']::public.ticketing_member_role[]
      )
  )
);

create policy ticket_types_update_managers
on public.ticket_types for update to authenticated
using (
  exists (
    select 1 from public.products product
    where product.id = product_id
      and public.ticketing_is_venue_member(
        product.venue_id,
        array['owner', 'admin', 'manager']::public.ticketing_member_role[]
      )
  )
)
with check (
  exists (
    select 1 from public.products product
    where product.id = product_id
      and public.ticketing_is_venue_member(
        product.venue_id,
        array['owner', 'admin', 'manager']::public.ticketing_member_role[]
      )
  )
);

create policy product_schedules_select_members
on public.product_schedules for select to authenticated
using (
  exists (
    select 1 from public.products product
    where product.id = product_id
      and public.ticketing_is_venue_member(product.venue_id)
  )
);

create policy product_schedules_write_managers
on public.product_schedules for all to authenticated
using (
  exists (
    select 1 from public.products product
    where product.id = product_id
      and public.ticketing_is_venue_member(
        product.venue_id,
        array['owner', 'admin', 'manager']::public.ticketing_member_role[]
      )
  )
)
with check (
  exists (
    select 1 from public.products product
    where product.id = product_id
      and public.ticketing_is_venue_member(
        product.venue_id,
        array['owner', 'admin', 'manager']::public.ticketing_member_role[]
      )
  )
);

create policy schedule_exceptions_select_members
on public.product_schedule_exceptions for select to authenticated
using (
  exists (
    select 1
    from public.product_schedules schedule
    join public.products product on product.id = schedule.product_id
    where schedule.id = schedule_id
      and public.ticketing_is_venue_member(product.venue_id)
  )
);

create policy schedule_exceptions_write_managers
on public.product_schedule_exceptions for all to authenticated
using (
  exists (
    select 1
    from public.product_schedules schedule
    join public.products product on product.id = schedule.product_id
    where schedule.id = schedule_id
      and public.ticketing_is_venue_member(
        product.venue_id,
        array['owner', 'admin', 'manager']::public.ticketing_member_role[]
      )
  )
)
with check (
  exists (
    select 1
    from public.product_schedules schedule
    join public.products product on product.id = schedule.product_id
    where schedule.id = schedule_id
      and public.ticketing_is_venue_member(
        product.venue_id,
        array['owner', 'admin', 'manager']::public.ticketing_member_role[]
      )
  )
);

create policy sessions_select_public_or_members
on public.sessions for select to anon, authenticated
using (
  exists (
    select 1
    from public.products product
    join public.venues venue on venue.id = product.venue_id
    where product.id = product_id
      and (
        public.ticketing_is_venue_member(product.venue_id)
        or (
          public.sessions.status = 'scheduled'
          and product.status = 'active'
          and venue.status = 'active'
        )
      )
  )
);

create policy sessions_write_managers
on public.sessions for all to authenticated
using (
  exists (
    select 1 from public.products product
    where product.id = product_id
      and public.ticketing_is_venue_member(
        product.venue_id,
        array['owner', 'admin', 'manager']::public.ticketing_member_role[]
      )
  )
)
with check (
  exists (
    select 1 from public.products product
    where product.id = product_id
      and public.ticketing_is_venue_member(
        product.venue_id,
        array['owner', 'admin', 'manager']::public.ticketing_member_role[]
      )
  )
);

create policy orders_select_customer_or_members
on public.orders for select to authenticated
using (
  customer_user_id = auth.uid()
  or public.ticketing_is_org_member(organization_id)
);

create policy order_items_select_customer_or_members
on public.order_items for select to authenticated
using (public.ticketing_can_read_order(order_id));

create policy inventory_holds_select_members
on public.inventory_holds for select to authenticated
using (
  exists (
    select 1
    from public.sessions session
    join public.products product on product.id = session.product_id
    where session.id = session_id
      and public.ticketing_is_venue_member(product.venue_id)
  )
);

-- ---------------------------------------------------------------------------
-- API grants. Orders and inventory holds are read-only from normal clients;
-- their write path will be an atomic database function in stage 1B.
-- ---------------------------------------------------------------------------

grant select on public.venues, public.products, public.ticket_types, public.sessions
  to anon;

grant select, insert, update on public.organizations to authenticated;
grant select, insert, update, delete on public.organization_memberships to authenticated;
grant select, insert, update on public.venues, public.products, public.ticket_types
  to authenticated;
grant select, insert, update, delete on
  public.product_schedules,
  public.product_schedule_exceptions,
  public.sessions
  to authenticated;
grant select on public.orders, public.order_items, public.inventory_holds
  to authenticated;

grant all on
  public.organizations,
  public.organization_memberships,
  public.venues,
  public.products,
  public.ticket_types,
  public.product_schedules,
  public.product_schedule_exceptions,
  public.sessions,
  public.orders,
  public.order_items,
  public.inventory_holds
  to service_role;

grant usage, select on sequence public.orders_order_number_seq to service_role;

comment on table public.products is
  'Canonical sellable offers. The Polish UI may label these records as Oferty.';
comment on column public.venues.sales_mode is
  'How EnjoyHub coexists with the venue ticketing system: native, quota, API or redirect.';
comment on column public.products.inventory_mode is
  'Product-level inventory mode; allocated_quota keeps the venue POS as its source of truth.';
comment on column public.ticket_types.capacity_units is
  'How many session capacity units one ticket consumes, e.g. a family ticket may consume four.';
comment on column public.sessions.capacity is
  'EnjoyHub sellable capacity. In allocated_quota mode this is the quota, not total venue capacity.';
comment on table public.inventory_holds is
  'Short-lived capacity reservations. Atomic creation and conversion are added in stage 1B.';

commit;
