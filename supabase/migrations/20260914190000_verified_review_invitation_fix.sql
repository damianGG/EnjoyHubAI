-- Fix PL/pgSQL output-column ambiguity in the invitation upsert.
create or replace function public.review_prepare_invitations()
returns table (
  invitation_id uuid,
  invitation_token uuid,
  recipient_email text,
  recipient_name text,
  property_id uuid,
  property_title text,
  used_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.review_invitations (
    order_id,
    property_id,
    recipient_email,
    recipient_name,
    available_after
  )
  select
    customer_order.id,
    venue.property_id,
    lower(btrim(customer_order.customer_email)),
    nullif(btrim(customer_order.customer_name), ''),
    min(ticket.used_at) + interval '12 hours'
  from public.orders customer_order
  join public.venues venue
    on venue.id = customer_order.venue_id
   and venue.property_id is not null
  join public.properties property
    on property.id = venue.property_id
   and property.is_active = true
  join public.tickets ticket
    on ticket.order_id = customer_order.id
   and ticket.status = 'used'
   and ticket.used_at is not null
  where customer_order.status = 'confirmed'
    and customer_order.payment_status = 'paid'
    and nullif(btrim(customer_order.customer_email), '') is not null
  group by
    customer_order.id,
    venue.property_id,
    customer_order.customer_email,
    customer_order.customer_name
  on conflict on constraint review_invitations_order_id_property_id_key do nothing;

  update public.review_invitations invitation
     set status = 'expired',
         updated_at = now()
   where invitation.status in ('pending','sent')
     and invitation.created_at < now() - interval '90 days';

  return query
  select
    invitation.id,
    invitation.token,
    invitation.recipient_email,
    invitation.recipient_name,
    invitation.property_id,
    property.title,
    first_used.used_at
  from public.review_invitations invitation
  join public.properties property
    on property.id = invitation.property_id
   and property.is_active = true
  join lateral (
    select min(ticket.used_at) as used_at
    from public.tickets ticket
    where ticket.order_id = invitation.order_id
      and ticket.status = 'used'
      and ticket.used_at is not null
  ) first_used on true
  where invitation.status = 'pending'
    and invitation.sent_at is null
    and invitation.available_after <= now()
    and first_used.used_at is not null
  order by invitation.available_after, invitation.created_at
  limit 100;
end;
$$;

revoke all on function public.review_prepare_invitations() from public, anon, authenticated;
grant execute on function public.review_prepare_invitations() to service_role;
