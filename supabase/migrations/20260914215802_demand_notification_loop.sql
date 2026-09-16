-- Close the marketplace demand loop:
-- new -> notified -> converted / closed.
-- Notifications are queued durably and only become eligible when the exact
-- requested date has enough sellable capacity for the requested party size.

begin;

alter table public.attraction_demand_requests
  add column if not exists notified_at timestamptz,
  add column if not exists converted_at timestamptz,
  add column if not exists closed_at timestamptz,
  add column if not exists conversion_order_id uuid references public.orders(id) on delete set null;

create index if not exists attraction_demand_requests_open_date_idx
  on public.attraction_demand_requests (desired_date, attraction_id)
  where status in ('new', 'notified');

create index if not exists attraction_demand_requests_conversion_order_idx
  on public.attraction_demand_requests (conversion_order_id)
  where conversion_order_id is not null;

create table if not exists public.attraction_demand_notifications (
  id uuid primary key default gen_random_uuid(),
  demand_request_id uuid not null unique references public.attraction_demand_requests(id) on delete cascade,
  attraction_id uuid not null references public.properties(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz not null default now(),
  lease_expires_at timestamptz,
  sent_at timestamptz,
  provider_message_id text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists attraction_demand_notifications_delivery_idx
  on public.attraction_demand_notifications (status, next_attempt_at, created_at);

alter table public.attraction_demand_notifications enable row level security;
revoke all on public.attraction_demand_notifications from public, anon, authenticated;
grant select, insert, update, delete on public.attraction_demand_notifications to service_role;

-- Preserve an already-delivered notification when a visitor submits the same
-- attraction/date again. Converted requests are immutable from the capture flow.
create or replace function public.marketplace_register_attraction_interest(
  p_attraction_id uuid,
  p_email text,
  p_desired_date date,
  p_party_size integer default 1
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  lead_row public.supply_leads%rowtype;
  normalized_email text := lower(btrim(coalesce(p_email, '')));
  request_id uuid;
begin
  if normalized_email = '' or length(normalized_email) > 320
     or normalized_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Valid email is required' using errcode = '22023';
  end if;

  if p_desired_date is null or p_desired_date < current_date or p_desired_date > current_date + 365 then
    raise exception 'Desired date must be within the next 365 days' using errcode = '22023';
  end if;

  if coalesce(p_party_size, 0) < 1 or p_party_size > 50 then
    raise exception 'Party size must be between 1 and 50' using errcode = '22023';
  end if;

  select lead.* into lead_row
  from public.supply_leads lead
  join public.properties property on property.id = lead.attraction_id
  where lead.attraction_id = p_attraction_id
    and property.is_active = true
    and lead.status in ('published','partner')
    and lead.claim_status <> 'claimed'
  limit 1;

  if not found then
    raise exception 'Attraction is not accepting marketplace interest' using errcode = 'P0002';
  end if;

  insert into public.attraction_demand_requests (
    attraction_id,
    supply_lead_id,
    user_id,
    email,
    desired_date,
    party_size,
    intent,
    source
  ) values (
    p_attraction_id,
    lead_row.id,
    auth.uid(),
    normalized_email,
    p_desired_date,
    p_party_size,
    'booking',
    'profile'
  )
  on conflict (attraction_id, email_normalized, desired_date) do update
    set party_size = excluded.party_size,
        user_id = coalesce(excluded.user_id, attraction_demand_requests.user_id),
        status = case
          when attraction_demand_requests.status in ('notified', 'converted')
            then attraction_demand_requests.status
          else 'new'
        end,
        closed_at = case
          when attraction_demand_requests.status = 'closed' then null
          else attraction_demand_requests.closed_at
        end,
        updated_at = now()
  returning id into request_id;

  return jsonb_build_object('requestId', request_id, 'accepted', true);
end;
$$;

revoke all on function public.marketplace_register_attraction_interest(uuid,text,date,integer)
  from public, anon, authenticated;
grant execute on function public.marketplace_register_attraction_interest(uuid,text,date,integer)
  to service_role;

-- Claim notification work in a retry-safe queue. Only exact requested dates with
-- enough live capacity are eligible. Organization legal/payment readiness is
-- checked here; Stripe Connect account readiness is additionally checked by the
-- cron route when Connect is enabled in the application environment.
create or replace function public.marketplace_prepare_demand_notifications(
  p_limit integer default 100
)
returns table (
  notification_id uuid,
  demand_request_id uuid,
  recipient_email text,
  attraction_id uuid,
  attraction_title text,
  desired_date date,
  party_size integer,
  organization_id uuid
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Requests for dates that have already passed can no longer be fulfilled.
  update public.attraction_demand_requests request
     set status = 'closed',
         closed_at = coalesce(request.closed_at, now()),
         updated_at = now()
   where request.status in ('new', 'notified')
     and request.desired_date < current_date;

  update public.attraction_demand_notifications notification
     set status = 'cancelled',
         lease_expires_at = null,
         updated_at = now()
    from public.attraction_demand_requests request
   where request.id = notification.demand_request_id
     and request.status in ('closed', 'converted')
     and notification.status <> 'sent';

  insert into public.attraction_demand_notifications (
    demand_request_id,
    attraction_id,
    organization_id
  )
  select
    request.id,
    request.attraction_id,
    eligible.organization_id
  from public.attraction_demand_requests request
  join public.properties property
    on property.id = request.attraction_id
   and property.is_active = true
  join lateral (
    select venue.organization_id
    from public.venues venue
    join public.organizations organization
      on organization.id = venue.organization_id
     and organization.verification_status = 'verified'
     and organization.payments_enabled = true
     and organization.trader_certified_at is not null
    join public.products product
      on product.venue_id = venue.id
     and product.status = 'active'
     and product.inventory_mode in ('native_enjoyhub', 'allocated_quota')
    join public.sessions session
      on session.product_id = product.id
     and session.status = 'scheduled'
    left join lateral (
      select coalesce(sum(hold.capacity_units) filter (
        where hold.status = 'converted'
           or (hold.status = 'active' and hold.expires_at > now())
      ), 0)::integer as reserved_capacity
      from public.inventory_holds hold
      where hold.session_id = session.id
    ) inventory on true
    where venue.property_id = request.attraction_id
      and venue.status = 'active'
      and (session.starts_at at time zone venue.timezone)::date = request.desired_date
      and now() < session.starts_at
      and (session.sales_starts_at is null or session.sales_starts_at <= now())
      and (session.sales_ends_at is null or session.sales_ends_at > now())
      and now() <= session.starts_at - make_interval(mins => product.booking_notice_minutes)
      and session.capacity - coalesce(inventory.reserved_capacity, 0) >= request.party_size
      and exists (
        select 1
        from public.ticket_types ticket
        where ticket.product_id = product.id
          and ticket.is_active = true
      )
    order by session.starts_at
    limit 1
  ) eligible on true
  where request.status = 'new'
    and request.desired_date >= current_date
  on conflict (demand_request_id) do nothing;

  return query
  with claimable as (
    select notification.id
    from public.attraction_demand_notifications notification
    join public.attraction_demand_requests request
      on request.id = notification.demand_request_id
     and request.status = 'new'
    where (
      notification.status in ('pending', 'failed')
      or (
        notification.status = 'processing'
        and notification.lease_expires_at is not null
        and notification.lease_expires_at <= now()
      )
    )
      and notification.next_attempt_at <= now()
    order by notification.next_attempt_at, notification.created_at
    for update of notification skip locked
    limit least(greatest(coalesce(p_limit, 100), 1), 250)
  ), claimed as (
    update public.attraction_demand_notifications notification
       set status = 'processing',
           attempt_count = notification.attempt_count + 1,
           lease_expires_at = now() + interval '15 minutes',
           last_error = null,
           updated_at = now()
      from claimable
     where notification.id = claimable.id
    returning notification.*
  )
  select
    claimed.id,
    request.id,
    request.email,
    request.attraction_id,
    property.title,
    request.desired_date,
    request.party_size,
    claimed.organization_id
  from claimed
  join public.attraction_demand_requests request
    on request.id = claimed.demand_request_id
  join public.properties property
    on property.id = request.attraction_id;
end;
$$;

create or replace function public.marketplace_complete_demand_notification(
  p_notification_id uuid,
  p_success boolean,
  p_provider_message_id text default null,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  delivery public.attraction_demand_notifications%rowtype;
  retry_minutes integer;
begin
  select * into delivery
  from public.attraction_demand_notifications
  where id = p_notification_id
  for update;

  if not found then
    raise exception 'Demand notification not found' using errcode = 'P0002';
  end if;

  if delivery.status = 'sent' then
    return;
  end if;

  if p_success then
    update public.attraction_demand_notifications
       set status = 'sent',
           sent_at = coalesce(sent_at, now()),
           provider_message_id = coalesce(nullif(btrim(coalesce(p_provider_message_id, '')), ''), provider_message_id),
           last_error = null,
           lease_expires_at = null,
           updated_at = now()
     where id = p_notification_id;

    update public.attraction_demand_requests
       set status = case when status = 'new' then 'notified' else status end,
           notified_at = case when status = 'new' then coalesce(notified_at, now()) else notified_at end,
           updated_at = now()
     where id = delivery.demand_request_id;
  else
    retry_minutes := least(1440, 15 * (2 ^ least(greatest(delivery.attempt_count - 1, 0), 6)));

    update public.attraction_demand_notifications
       set status = 'failed',
           next_attempt_at = now() + make_interval(mins => retry_minutes),
           last_error = left(coalesce(p_error, 'Unknown delivery error'), 2000),
           lease_expires_at = null,
           updated_at = now()
     where id = p_notification_id;
  end if;
end;
$$;

create or replace function public.marketplace_defer_demand_notification(
  p_notification_id uuid,
  p_retry_minutes integer default 360,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.attraction_demand_notifications
     set status = 'pending',
         attempt_count = greatest(attempt_count - 1, 0),
         next_attempt_at = now() + make_interval(mins => least(greatest(coalesce(p_retry_minutes, 360), 15), 10080)),
         lease_expires_at = null,
         last_error = left(coalesce(p_reason, 'Delivery deferred'), 2000),
         updated_at = now()
   where id = p_notification_id
     and status = 'processing';
end;
$$;

revoke all on function public.marketplace_prepare_demand_notifications(integer)
  from public, anon, authenticated;
revoke all on function public.marketplace_complete_demand_notification(uuid,boolean,text,text)
  from public, anon, authenticated;
revoke all on function public.marketplace_defer_demand_notification(uuid,integer,text)
  from public, anon, authenticated;
grant execute on function public.marketplace_prepare_demand_notifications(integer) to service_role;
grant execute on function public.marketplace_complete_demand_notification(uuid,boolean,text,text) to service_role;
grant execute on function public.marketplace_defer_demand_notification(uuid,integer,text) to service_role;

-- Any confirmed paid order from the same e-mail for the same attraction closes
-- the attribution loop. This is payment-provider agnostic and survives webhook
-- retries because setting converted is idempotent.
create or replace function public.marketplace_convert_demand_from_paid_order()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status <> 'confirmed' or new.payment_status <> 'paid' then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and old.status = 'confirmed'
     and old.payment_status = 'paid' then
    return new;
  end if;

  update public.attraction_demand_requests request
     set status = 'converted',
         converted_at = coalesce(request.converted_at, now()),
         conversion_order_id = coalesce(request.conversion_order_id, new.id),
         updated_at = now()
   where request.email_normalized = lower(btrim(new.customer_email))
     and request.status in ('new', 'notified')
     and exists (
       select 1
       from public.order_items item
       join public.products product on product.id = item.product_id
       where item.order_id = new.id
         and product.attraction_id = request.attraction_id
     );

  update public.attraction_demand_notifications notification
     set status = 'cancelled',
         lease_expires_at = null,
         updated_at = now()
    from public.attraction_demand_requests request
   where request.id = notification.demand_request_id
     and request.conversion_order_id = new.id
     and notification.status <> 'sent';

  return new;
end;
$$;

drop trigger if exists marketplace_convert_demand_from_paid_order_trigger on public.orders;
create trigger marketplace_convert_demand_from_paid_order_trigger
after insert or update of status, payment_status on public.orders
for each row execute function public.marketplace_convert_demand_from_paid_order();

-- Current unmet demand only. Converted customers should no longer inflate Supply
-- prioritization or the owner-facing "people waiting" proof.
create or replace function public.profile_claim_get(p_attraction_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((
    select jsonb_build_object(
      'attractionId', property.id,
      'name', property.title,
      'city', property.city,
      'claimable', lead.claim_status <> 'claimed',
      'claimStatus', lead.claim_status,
      'organizationName', organization.name,
      'demandPeople30d', coalesce(demand.people_30d, 0),
      'demandRequests30d', coalesce(demand.requests_30d, 0),
      'requestedSeats30d', coalesce(demand.seats_30d, 0),
      'estimatedValue30d', coalesce(demand.value_30d, 0),
      'demandTotal', coalesce(demand.total_requests, 0),
      'nextRequestedDate', demand.next_requested_date
    )
    from public.properties property
    join public.supply_leads lead on lead.attraction_id = property.id
    join public.organizations organization on organization.id = lead.organization_id
    left join lateral (
      select
        count(distinct request.email_normalized) filter (where request.updated_at >= now() - interval '30 days') as people_30d,
        count(*) filter (where request.updated_at >= now() - interval '30 days') as requests_30d,
        coalesce(sum(request.party_size) filter (where request.updated_at >= now() - interval '30 days'), 0) as seats_30d,
        coalesce(sum(request.party_size) filter (where request.updated_at >= now() - interval '30 days'), 0) * coalesce(lead.price_from, 0) as value_30d,
        count(*) as total_requests,
        min(request.desired_date) filter (where request.desired_date >= current_date and request.updated_at >= now() - interval '30 days') as next_requested_date
      from public.attraction_demand_requests request
      where request.supply_lead_id = lead.id
        and request.status in ('new', 'notified')
    ) demand on true
    where property.id = p_attraction_id
      and property.is_active = true
      and lead.status in ('published','partner')
    limit 1
  ), jsonb_build_object('attractionId', p_attraction_id, 'claimable', false));
$$;

revoke all on function public.profile_claim_get(uuid) from public;
grant execute on function public.profile_claim_get(uuid) to anon, authenticated;

create or replace function public.platform_supply_list_leads_with_demand(
  p_search text default null,
  p_status text default null,
  p_region text default null,
  p_limit integer default 250
)
returns table (
  lead_id uuid,
  lead_name text,
  city text,
  region text,
  category_name text,
  subcategory_name text,
  score integer,
  priority_score integer,
  status text,
  claim_status text,
  booking_method text,
  price_from numeric,
  currency text,
  review_rating numeric,
  review_count integer,
  phone text,
  website_url text,
  attraction_id uuid,
  demand_people_30d bigint,
  demand_requests_30d bigint,
  demand_seats_30d bigint,
  estimated_demand_value_30d numeric,
  next_requested_date date,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  staff_role public.platform_staff_role := public.platform_current_staff_role();
begin
  if staff_role not in ('platform_superadmin','platform_support','platform_content') then
    raise exception 'Supply access required' using errcode = '42501';
  end if;

  return query
  select
    lead.id,
    lead.name,
    lead.city,
    lead.region,
    category.name,
    subcategory.name,
    lead.score,
    least(100, lead.score + least(30, (coalesce(demand.people_30d, 0) * 6)::integer))::integer as priority_score,
    lead.status,
    lead.claim_status,
    lead.booking_method,
    lead.price_from,
    lead.currency,
    lead.review_rating,
    lead.review_count,
    lead.phone,
    lead.website_url,
    lead.attraction_id,
    coalesce(demand.people_30d, 0),
    coalesce(demand.requests_30d, 0),
    coalesce(demand.seats_30d, 0),
    coalesce(demand.seats_30d, 0) * coalesce(lead.price_from, 0) as estimated_demand_value_30d,
    demand.next_requested_date,
    lead.updated_at
  from public.supply_leads lead
  left join public.categories category on category.id = lead.category_id
  left join public.subcategories subcategory on subcategory.id = lead.subcategory_id
  left join lateral (
    select
      count(distinct request.email_normalized) filter (where request.updated_at >= now() - interval '30 days') as people_30d,
      count(*) filter (where request.updated_at >= now() - interval '30 days') as requests_30d,
      coalesce(sum(request.party_size) filter (where request.updated_at >= now() - interval '30 days'), 0)::bigint as seats_30d,
      min(request.desired_date) filter (where request.desired_date >= current_date and request.updated_at >= now() - interval '30 days') as next_requested_date
    from public.attraction_demand_requests request
    where request.supply_lead_id = lead.id
      and request.status in ('new', 'notified')
  ) demand on true
  where (p_search is null or btrim(p_search) = ''
      or lead.name ilike '%' || btrim(p_search) || '%'
      or coalesce(lead.city, '') ilike '%' || btrim(p_search) || '%'
      or coalesce(lead.website_url, '') ilike '%' || btrim(p_search) || '%'
      or coalesce(lead.phone, '') ilike '%' || btrim(p_search) || '%')
    and (p_status is null or btrim(p_status) = '' or lead.status = p_status)
    and (p_region is null or btrim(p_region) = '' or lead.region = p_region)
  order by
    least(100, lead.score + least(30, (coalesce(demand.people_30d, 0) * 6)::integer)) desc,
    coalesce(demand.people_30d, 0) desc,
    lead.score desc,
    lead.updated_at desc
  limit least(greatest(coalesce(p_limit, 250), 1), 500);
end;
$$;

revoke all on function public.platform_supply_list_leads_with_demand(text,text,text,integer)
  from public, anon;
grant execute on function public.platform_supply_list_leads_with_demand(text,text,text,integer)
  to authenticated;

commit;