-- EnjoyHubAI ticketing core - stage 1D
-- Stripe Checkout payment attempts, idempotent webhook processing and tickets.

begin;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'ticketing_payment_attempt_status'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.ticketing_payment_attempt_status as enum (
      'creating',
      'open',
      'paid',
      'failed',
      'expired',
      'requires_review'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'ticketing_payment_event_status'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.ticketing_payment_event_status as enum (
      'processing',
      'processed',
      'ignored'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'ticketing_ticket_status'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.ticketing_ticket_status as enum (
      'valid',
      'used',
      'void'
    );
  end if;
end
$$;

create table public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  provider text not null check (provider in ('stripe')),
  attempt_token uuid not null default gen_random_uuid() unique,
  provider_checkout_id text,
  provider_payment_id text,
  status public.ticketing_payment_attempt_status not null default 'creating',
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  checkout_expires_at timestamptz,
  failure_code text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, provider)
);

create unique index payment_attempts_provider_checkout_idx
  on public.payment_attempts(provider, provider_checkout_id)
  where provider_checkout_id is not null;

create unique index payment_attempts_provider_payment_idx
  on public.payment_attempts(provider, provider_payment_id)
  where provider_payment_id is not null;

create index payment_attempts_status_created_at_idx
  on public.payment_attempts(status, created_at desc);

create table public.payment_webhook_events (
  provider text not null check (provider in ('stripe')),
  provider_event_id text not null,
  event_type text not null,
  payload_sha256 text not null check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  status public.ticketing_payment_event_status not null default 'processing',
  payment_attempt_id uuid references public.payment_attempts(id) on delete restrict,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (provider, provider_event_id)
);

create index payment_webhook_events_created_at_idx
  on public.payment_webhook_events(created_at desc);

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_code uuid not null default gen_random_uuid() unique,
  order_id uuid not null references public.orders(id) on delete restrict,
  order_item_id uuid not null references public.order_items(id) on delete restrict,
  sequence_number integer not null check (sequence_number > 0),
  status public.ticketing_ticket_status not null default 'valid',
  issued_at timestamptz not null default now(),
  used_at timestamptz,
  used_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  unique (order_item_id, sequence_number),
  check (
    (status = 'used' and used_at is not null)
    or status <> 'used'
  )
);

create index tickets_order_id_idx on public.tickets(order_id);
create index tickets_status_issued_at_idx on public.tickets(status, issued_at desc);

create trigger ticketing_payment_attempts_updated_at
before update on public.payment_attempts
for each row execute function public.ticketing_set_updated_at();

alter table public.payment_attempts enable row level security;
alter table public.payment_webhook_events enable row level security;
alter table public.tickets enable row level security;

create policy payment_attempts_select_customer_or_members
on public.payment_attempts for select to authenticated
using (public.ticketing_can_read_order(order_id));

create policy tickets_select_customer_or_members
on public.tickets for select to authenticated
using (public.ticketing_can_read_order(order_id));

revoke all privileges on table
  public.payment_attempts,
  public.payment_webhook_events,
  public.tickets
from public, anon, authenticated;

grant select on public.payment_attempts, public.tickets to authenticated;

grant all privileges on table
  public.payment_attempts,
  public.payment_webhook_events,
  public.tickets
to service_role;

-- Creates or reuses the one Stripe payment attempt for an order and extends
-- the inventory hold. The extra hold time is a safety buffer: Stripe Checkout
-- expires first, leaving time for the signed webhook to arrive.
create or replace function public.ticketing_prepare_payment_checkout(
  p_order_id uuid,
  p_hold_token uuid,
  p_provider text default 'stripe',
  p_hold_minutes integer default 35
)
returns table (
  payment_attempt_id uuid,
  payment_attempt_token uuid,
  current_provider_checkout_id text,
  current_attempt_status public.ticketing_payment_attempt_status,
  payment_order_number bigint,
  payment_amount_minor bigint,
  payment_currency text,
  payment_customer_email text,
  payment_hold_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  checkout_state record;
  attempt_state record;
  payment_time timestamptz := clock_timestamp();
  extended_expiry timestamptz;
begin
  if p_order_id is null or p_hold_token is null then
    raise exception 'Order and hold token are required'
      using errcode = '22023';
  end if;

  if p_provider <> 'stripe' then
    raise exception 'Unsupported payment provider'
      using errcode = '22023';
  end if;

  if p_hold_minutes is null or p_hold_minutes < 35 or p_hold_minutes > 60 then
    raise exception 'Payment hold must contain between 35 and 60 minutes'
      using errcode = '22023';
  end if;

  select
    customer_order.order_number,
    customer_order.status as order_status,
    customer_order.payment_status,
    customer_order.total_amount,
    customer_order.currency,
    customer_order.customer_email,
    hold.status as hold_status,
    hold.expires_at as hold_expires_at,
    (
      select min(session.starts_at)
      from public.order_items item
      join public.sessions session on session.id = item.session_id
      where item.order_id = customer_order.id
    ) as session_starts_at
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

  if checkout_state.order_status <> 'awaiting_payment'
     or checkout_state.payment_status not in ('unpaid', 'pending')
     or checkout_state.hold_status <> 'active'
     or checkout_state.hold_expires_at <= payment_time then
    raise exception 'Order is not awaiting an active payment hold'
      using errcode = 'P0001';
  end if;

  if checkout_state.total_amount <= 0 then
    raise exception 'Order total must be greater than zero'
      using errcode = '22023';
  end if;

  -- The first production payment methods are BLIK and Przelewy24 through
  -- Stripe. Both use PLN in this pilot, so minor units are always grosze.
  if checkout_state.currency <> 'PLN' then
    raise exception 'Stage 1D Stripe checkout supports PLN orders only'
      using errcode = '22023';
  end if;

  extended_expiry := payment_time + make_interval(mins => p_hold_minutes);

  if checkout_state.session_starts_at <= extended_expiry + interval '1 minute' then
    raise exception 'The session starts too soon to open a payment checkout'
      using errcode = 'P0001';
  end if;

  update public.inventory_holds
     set expires_at = greatest(expires_at, extended_expiry)
   where order_id = p_order_id
     and hold_token = p_hold_token;

  update public.orders
     set expires_at = greatest(coalesce(expires_at, extended_expiry), extended_expiry),
         payment_status = 'pending'
   where id = p_order_id;

  insert into public.payment_attempts (
    order_id,
    provider,
    status,
    amount_minor,
    currency,
    metadata
  ) values (
    p_order_id,
    p_provider,
    'creating',
    round(checkout_state.total_amount * 100)::bigint,
    checkout_state.currency,
    jsonb_build_object('stage', '1d')
  )
  on conflict (order_id, provider) do nothing;

  select
    attempt.id,
    attempt.attempt_token,
    attempt.provider_checkout_id,
    attempt.status,
    attempt.amount_minor,
    attempt.currency
    into attempt_state
    from public.payment_attempts attempt
   where attempt.order_id = p_order_id
     and attempt.provider = p_provider
   for update;

  if attempt_state.status not in ('creating', 'open') then
    raise exception 'The payment attempt cannot be opened again'
      using errcode = 'P0001';
  end if;

  if attempt_state.amount_minor <> round(checkout_state.total_amount * 100)::bigint
     or attempt_state.currency <> checkout_state.currency then
    raise exception 'The order total changed after payment preparation'
      using errcode = 'P0001';
  end if;

  return query select
    attempt_state.id,
    attempt_state.attempt_token,
    attempt_state.provider_checkout_id,
    attempt_state.status,
    checkout_state.order_number,
    attempt_state.amount_minor,
    attempt_state.currency,
    checkout_state.customer_email,
    extended_expiry;
end;
$$;

-- Attaches the Stripe Checkout Session created with the attempt ID as the
-- Stripe idempotency key. A retry may attach the same session, never another.
create or replace function public.ticketing_attach_payment_checkout(
  p_payment_attempt_id uuid,
  p_payment_attempt_token uuid,
  p_provider_checkout_id text,
  p_checkout_expires_at timestamptz
)
returns table (
  attached_payment_attempt_id uuid,
  attached_provider_checkout_id text,
  attached_attempt_status public.ticketing_payment_attempt_status
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  attempt_state record;
  hold_expiry timestamptz;
begin
  if p_payment_attempt_id is null
     or p_payment_attempt_token is null
     or char_length(btrim(coalesce(p_provider_checkout_id, ''))) < 8
     or p_checkout_expires_at is null then
    raise exception 'Complete provider checkout data is required'
      using errcode = '22023';
  end if;

  select attempt.*
    into attempt_state
    from public.payment_attempts attempt
   where attempt.id = p_payment_attempt_id
     and attempt.attempt_token = p_payment_attempt_token
   for update;

  if not found then
    raise exception 'Payment attempt token does not match'
      using errcode = 'P0002';
  end if;

  select hold.expires_at
    into hold_expiry
    from public.inventory_holds hold
   where hold.order_id = attempt_state.order_id
     and hold.status = 'active'
   for update;

  if hold_expiry is null or hold_expiry <= clock_timestamp() then
    raise exception 'Inventory hold expired before payment checkout was attached'
      using errcode = 'P0001';
  end if;

  if p_checkout_expires_at > hold_expiry then
    raise exception 'Provider checkout must expire before the inventory hold'
      using errcode = '22023';
  end if;

  if attempt_state.provider_checkout_id is not null
     and attempt_state.provider_checkout_id <> p_provider_checkout_id then
    raise exception 'A different provider checkout is already attached'
      using errcode = '23505';
  end if;

  update public.payment_attempts
     set provider_checkout_id = p_provider_checkout_id,
         checkout_expires_at = p_checkout_expires_at,
         status = 'open'
   where id = p_payment_attempt_id;

  return query select
    p_payment_attempt_id,
    p_provider_checkout_id,
    'open'::public.ticketing_payment_attempt_status;
end;
$$;

-- Completes fulfillment from a verified Stripe webhook. The event record,
-- order confirmation, hold conversion and ticket issuance share one database
-- transaction, so retries and concurrent deliveries cannot issue twice.
create or replace function public.ticketing_confirm_provider_payment(
  p_provider_event_id text,
  p_event_type text,
  p_payload_sha256 text,
  p_payment_attempt_id uuid,
  p_provider_checkout_id text,
  p_provider_payment_id text,
  p_amount_minor bigint,
  p_currency text,
  p_paid_at timestamptz,
  p_payment_metadata jsonb default '{}'::jsonb
)
returns table (
  confirmed_order_id uuid,
  current_order_status public.ticketing_order_status,
  current_payment_status public.ticketing_payment_status,
  issued_ticket_count integer,
  event_was_duplicate boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  inserted_event_id text;
  stored_event record;
  payment_state record;
  fulfillment_time timestamptz := clock_timestamp();
  ticket_count integer := 0;
begin
  if char_length(btrim(coalesce(p_provider_event_id, ''))) < 4
     or char_length(btrim(coalesce(p_event_type, ''))) < 4
     or p_payload_sha256 !~ '^[0-9a-f]{64}$'
     or p_payment_attempt_id is null
     or char_length(btrim(coalesce(p_provider_checkout_id, ''))) < 8
     or p_amount_minor is null
     or p_amount_minor <= 0
     or p_paid_at is null
     or p_payment_metadata is null
     or jsonb_typeof(p_payment_metadata) <> 'object' then
    raise exception 'Complete verified payment data is required'
      using errcode = '22023';
  end if;

  insert into public.payment_webhook_events (
    provider,
    provider_event_id,
    event_type,
    payload_sha256,
    payment_attempt_id
  ) values (
    'stripe',
    p_provider_event_id,
    p_event_type,
    p_payload_sha256,
    p_payment_attempt_id
  )
  on conflict (provider, provider_event_id) do nothing
  returning provider_event_id into inserted_event_id;

  if inserted_event_id is null then
    select event.payload_sha256, event.payment_attempt_id
      into stored_event
      from public.payment_webhook_events event
     where event.provider = 'stripe'
       and event.provider_event_id = p_provider_event_id;

    if stored_event.payload_sha256 <> p_payload_sha256
       or stored_event.payment_attempt_id is distinct from p_payment_attempt_id then
      raise exception 'Webhook event ID was reused with different content'
        using errcode = 'P0001';
    end if;

    select
      attempt.order_id,
      customer_order.status as order_status,
      customer_order.payment_status,
      count(ticket.id)::integer as ticket_count
      into payment_state
      from public.payment_attempts attempt
      join public.orders customer_order on customer_order.id = attempt.order_id
      left join public.tickets ticket on ticket.order_id = customer_order.id
     where attempt.id = p_payment_attempt_id
     group by attempt.order_id, customer_order.status, customer_order.payment_status;

    return query select
      payment_state.order_id,
      payment_state.order_status,
      payment_state.payment_status,
      coalesce(payment_state.ticket_count, 0),
      true;
    return;
  end if;

  select
    attempt.order_id,
    attempt.provider_checkout_id,
    attempt.provider_payment_id,
    attempt.status as attempt_status,
    attempt.amount_minor,
    attempt.currency,
    attempt.checkout_expires_at,
    customer_order.status as order_status,
    customer_order.payment_status,
    hold.status as hold_status,
    hold.expires_at as hold_expires_at
    into payment_state
    from public.payment_attempts attempt
    join public.orders customer_order on customer_order.id = attempt.order_id
    join public.inventory_holds hold on hold.order_id = customer_order.id
   where attempt.id = p_payment_attempt_id
   for update of attempt, customer_order, hold;

  if not found then
    raise exception 'Payment attempt does not exist'
      using errcode = 'P0002';
  end if;

  if payment_state.provider_checkout_id <> p_provider_checkout_id
     or payment_state.amount_minor <> p_amount_minor
     or payment_state.currency <> upper(p_currency) then
    raise exception 'Verified payment does not match the prepared order'
      using errcode = 'P0001';
  end if;

  if payment_state.provider_payment_id is not null
     and payment_state.provider_payment_id is distinct from p_provider_payment_id then
    raise exception 'A different provider payment is already attached'
      using errcode = '23505';
  end if;

  if payment_state.order_status = 'confirmed'
     and payment_state.payment_status = 'paid'
     and payment_state.attempt_status = 'paid'
     and payment_state.hold_status = 'converted' then
    update public.payment_webhook_events
       set status = 'processed', processed_at = fulfillment_time
     where provider = 'stripe' and provider_event_id = p_provider_event_id;

    select count(*)::integer into ticket_count
    from public.tickets where order_id = payment_state.order_id;

    return query select
      payment_state.order_id,
      payment_state.order_status,
      payment_state.payment_status,
      ticket_count,
      false;
    return;
  end if;

  if payment_state.order_status <> 'awaiting_payment'
     or payment_state.hold_status <> 'active'
     or payment_state.hold_expires_at <= fulfillment_time
     or payment_state.checkout_expires_at is null
     or p_paid_at > payment_state.checkout_expires_at + interval '2 minutes' then
    update public.payment_attempts
       set status = 'requires_review',
           failure_code = 'paid_after_inventory_expiry',
           provider_payment_id = nullif(btrim(p_provider_payment_id), '')
     where id = p_payment_attempt_id;

    update public.payment_webhook_events
       set status = 'processed', processed_at = fulfillment_time
     where provider = 'stripe' and provider_event_id = p_provider_event_id;

    return query select
      payment_state.order_id,
      payment_state.order_status,
      payment_state.payment_status,
      0,
      false;
    return;
  end if;

  update public.inventory_holds
     set status = 'converted', converted_at = fulfillment_time
   where order_id = payment_state.order_id;

  update public.orders
     set status = 'confirmed',
         payment_status = 'paid',
         confirmed_at = coalesce(confirmed_at, fulfillment_time),
         metadata = metadata || jsonb_build_object(
           'payment',
           p_payment_metadata || jsonb_build_object(
             'provider', 'stripe',
             'provider_checkout_id', p_provider_checkout_id
           )
         )
   where id = payment_state.order_id;

  update public.payment_attempts
     set status = 'paid',
         provider_payment_id = nullif(btrim(p_provider_payment_id), ''),
         failure_code = null,
         metadata = metadata || p_payment_metadata
   where id = p_payment_attempt_id;

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
    jsonb_build_object('issued_by', 'stripe_webhook')
  from public.order_items item
  cross join lateral generate_series(1, item.quantity) generated(sequence_number)
  where item.order_id = payment_state.order_id
  on conflict (order_item_id, sequence_number) do nothing;

  select count(*)::integer into ticket_count
  from public.tickets where order_id = payment_state.order_id;

  update public.payment_webhook_events
     set status = 'processed', processed_at = fulfillment_time
   where provider = 'stripe' and provider_event_id = p_provider_event_id;

  return query select
    payment_state.order_id,
    'confirmed'::public.ticketing_order_status,
    'paid'::public.ticketing_payment_status,
    ticket_count,
    false;
end;
$$;

-- Records terminal Stripe Checkout events. Expired or failed attempts release
-- only unpaid inventory; a paid/confirmed order is never reverted here.
create or replace function public.ticketing_close_provider_payment(
  p_provider_event_id text,
  p_event_type text,
  p_payload_sha256 text,
  p_provider_checkout_id text,
  p_terminal_status public.ticketing_payment_attempt_status,
  p_failure_code text default null
)
returns table (
  closed_payment_attempt_id uuid,
  closed_order_id uuid,
  closed_attempt_status public.ticketing_payment_attempt_status,
  closed_order_status public.ticketing_order_status,
  event_was_duplicate boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  inserted_event_id text;
  stored_event record;
  close_state record;
  close_time timestamptz := clock_timestamp();
begin
  if char_length(btrim(coalesce(p_provider_event_id, ''))) < 4
     or char_length(btrim(coalesce(p_event_type, ''))) < 4
     or p_payload_sha256 !~ '^[0-9a-f]{64}$'
     or char_length(btrim(coalesce(p_provider_checkout_id, ''))) < 8
     or p_terminal_status not in ('failed', 'expired') then
    raise exception 'Complete terminal payment data is required'
      using errcode = '22023';
  end if;

  select
    attempt.id,
    attempt.order_id,
    attempt.status as attempt_status,
    customer_order.status as order_status,
    customer_order.payment_status,
    hold.status as hold_status
    into close_state
    from public.payment_attempts attempt
    join public.orders customer_order on customer_order.id = attempt.order_id
    join public.inventory_holds hold on hold.order_id = customer_order.id
   where attempt.provider = 'stripe'
     and attempt.provider_checkout_id = p_provider_checkout_id
   for update of attempt, customer_order, hold;

  if not found then
    raise exception 'Provider checkout does not match a payment attempt'
      using errcode = 'P0002';
  end if;

  insert into public.payment_webhook_events (
    provider,
    provider_event_id,
    event_type,
    payload_sha256,
    payment_attempt_id
  ) values (
    'stripe',
    p_provider_event_id,
    p_event_type,
    p_payload_sha256,
    close_state.id
  )
  on conflict (provider, provider_event_id) do nothing
  returning provider_event_id into inserted_event_id;

  if inserted_event_id is null then
    select event.payload_sha256, event.payment_attempt_id
      into stored_event
      from public.payment_webhook_events event
     where event.provider = 'stripe'
       and event.provider_event_id = p_provider_event_id;

    if stored_event.payload_sha256 <> p_payload_sha256
       or stored_event.payment_attempt_id is distinct from close_state.id then
      raise exception 'Webhook event ID was reused with different content'
        using errcode = 'P0001';
    end if;

    return query select
      close_state.id,
      close_state.order_id,
      close_state.attempt_status,
      close_state.order_status,
      true;
    return;
  end if;

  if close_state.order_status = 'confirmed'
     or close_state.payment_status = 'paid'
     or close_state.attempt_status = 'paid'
     or close_state.hold_status = 'converted' then
    update public.payment_webhook_events
       set status = 'ignored', processed_at = close_time
     where provider = 'stripe' and provider_event_id = p_provider_event_id;

    return query select
      close_state.id,
      close_state.order_id,
      close_state.attempt_status,
      close_state.order_status,
      false;
    return;
  end if;

  update public.payment_attempts
     set status = p_terminal_status,
         failure_code = nullif(btrim(p_failure_code), '')
   where id = close_state.id;

  update public.inventory_holds
     set status = case
       when p_terminal_status = 'expired' then 'expired'::public.ticketing_hold_status
       else 'released'::public.ticketing_hold_status
     end
   where order_id = close_state.order_id
     and status = 'active';

  update public.orders
     set status = case
       when p_terminal_status = 'expired' then 'expired'::public.ticketing_order_status
       else 'cancelled'::public.ticketing_order_status
     end,
         payment_status = case
           when p_terminal_status = 'failed' then 'failed'::public.ticketing_payment_status
           else 'unpaid'::public.ticketing_payment_status
         end,
         cancelled_at = case
           when p_terminal_status = 'failed' then close_time
           else cancelled_at
         end
   where id = close_state.order_id
     and status = 'awaiting_payment';

  update public.payment_webhook_events
     set status = 'processed', processed_at = close_time
   where provider = 'stripe' and provider_event_id = p_provider_event_id;

  return query
  select
    attempt.id,
    attempt.order_id,
    attempt.status,
    customer_order.status,
    false
  from public.payment_attempts attempt
  join public.orders customer_order on customer_order.id = attempt.order_id
  where attempt.id = close_state.id;
end;
$$;

-- Cashiers redeem a ticket through an authenticated server request. The
-- function verifies organization membership itself, locks the ticket row and
-- returns an explicit already-used result for repeated scans.
create or replace function public.ticketing_redeem_ticket(
  p_ticket_code uuid
)
returns table (
  redeemed_ticket_id uuid,
  redeemed_order_id uuid,
  redeemed_ticket_code uuid,
  current_ticket_status public.ticketing_ticket_status,
  ticket_used_at timestamptz,
  ticket_was_already_used boolean,
  redeemed_product_name text,
  redeemed_ticket_type_name text,
  redeemed_session_starts_at timestamptz,
  redeemed_venue_name text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  ticket_state record;
  cashier_user_id uuid := auth.uid();
  redemption_time timestamptz := clock_timestamp();
begin
  if p_ticket_code is null then
    raise exception 'Ticket code is required'
      using errcode = '22023';
  end if;

  if cashier_user_id is null then
    raise exception 'Authentication is required to redeem tickets'
      using errcode = '42501';
  end if;

  select
    ticket.id,
    ticket.order_id,
    ticket.ticket_code,
    ticket.status,
    ticket.used_at,
    customer_order.organization_id,
    item.product_name,
    item.ticket_type_name,
    session.starts_at,
    venue.name as venue_name
    into ticket_state
    from public.tickets ticket
    join public.orders customer_order on customer_order.id = ticket.order_id
    join public.order_items item on item.id = ticket.order_item_id
    join public.sessions session on session.id = item.session_id
    join public.products product on product.id = item.product_id
    join public.venues venue on venue.id = product.venue_id
   where ticket.ticket_code = p_ticket_code
   for update of ticket;

  if not found then
    raise exception 'Ticket does not exist'
      using errcode = 'P0002';
  end if;

  if not public.ticketing_is_org_member(
    ticket_state.organization_id,
    array['owner', 'admin', 'manager', 'cashier']::public.ticketing_member_role[]
  ) then
    raise exception 'User cannot redeem tickets for this organization'
      using errcode = '42501';
  end if;

  if ticket_state.status = 'void' then
    raise exception 'A void ticket cannot be redeemed'
      using errcode = 'P0001';
  end if;

  if ticket_state.status = 'used' then
    return query select
      ticket_state.id,
      ticket_state.order_id,
      ticket_state.ticket_code,
      ticket_state.status,
      ticket_state.used_at,
      true,
      ticket_state.product_name,
      ticket_state.ticket_type_name,
      ticket_state.starts_at,
      ticket_state.venue_name;
    return;
  end if;

  update public.tickets
     set status = 'used',
         used_at = redemption_time,
         used_by = cashier_user_id
   where id = ticket_state.id;

  return query select
    ticket_state.id,
    ticket_state.order_id,
    ticket_state.ticket_code,
    'used'::public.ticketing_ticket_status,
    redemption_time,
    false,
    ticket_state.product_name,
    ticket_state.ticket_type_name,
    ticket_state.starts_at,
    ticket_state.venue_name;
end;
$$;

revoke all on function public.ticketing_prepare_payment_checkout(uuid, uuid, text, integer)
from public, anon, authenticated;
revoke all on function public.ticketing_attach_payment_checkout(uuid, uuid, text, timestamptz)
from public, anon, authenticated;
revoke all on function public.ticketing_confirm_provider_payment(
  text, text, text, uuid, text, text, bigint, text, timestamptz, jsonb
) from public, anon, authenticated;
revoke all on function public.ticketing_close_provider_payment(
  text, text, text, text, public.ticketing_payment_attempt_status, text
) from public, anon, authenticated;
revoke all on function public.ticketing_redeem_ticket(uuid)
from public, anon, authenticated;

grant execute on function public.ticketing_prepare_payment_checkout(uuid, uuid, text, integer)
to service_role;
grant execute on function public.ticketing_attach_payment_checkout(uuid, uuid, text, timestamptz)
to service_role;
grant execute on function public.ticketing_confirm_provider_payment(
  text, text, text, uuid, text, text, bigint, text, timestamptz, jsonb
) to service_role;
grant execute on function public.ticketing_close_provider_payment(
  text, text, text, text, public.ticketing_payment_attempt_status, text
) to service_role;
grant execute on function public.ticketing_redeem_ticket(uuid)
to authenticated, service_role;

comment on table public.payment_attempts is
  'Server-only snapshot linking one EnjoyHub order to its Stripe Checkout Session.';
comment on table public.payment_webhook_events is
  'Immutable Stripe event IDs and payload hashes used for idempotent fulfillment.';
comment on table public.tickets is
  'One independently verifiable admission ticket per purchased order-item quantity.';
comment on function public.ticketing_confirm_provider_payment(
  text, text, text, uuid, text, text, bigint, text, timestamptz, jsonb
) is 'Atomically confirms a verified Stripe payment and issues tickets exactly once.';
comment on function public.ticketing_redeem_ticket(uuid) is
  'Atomically redeems a ticket for an authenticated owner, admin, manager or cashier.';

commit;
