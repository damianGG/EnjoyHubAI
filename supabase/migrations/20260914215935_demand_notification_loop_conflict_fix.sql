-- PL/pgSQL output columns are variables, so use the concrete unique constraint
-- rather than an unqualified ON CONFLICT column target.

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
     and organization.trader_self_certified_at is not null
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
  on conflict on constraint attraction_demand_notifications_demand_request_id_key do nothing;

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

revoke all on function public.marketplace_prepare_demand_notifications(integer)
  from public, anon, authenticated;
grant execute on function public.marketplace_prepare_demand_notifications(integer)
  to service_role;
