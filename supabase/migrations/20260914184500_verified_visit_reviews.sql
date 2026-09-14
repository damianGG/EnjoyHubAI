-- Verified visit reviews for canonical EnjoyHub ticketing.
-- A review becomes verified only when the related paid order has at least one
-- ticket that was actually redeemed at the venue.

alter table public.reviews
  add column if not exists ticketing_order_id uuid references public.orders(id) on delete set null,
  add column if not exists author_name text,
  add column if not exists verified_visit boolean not null default false,
  add column if not exists verified_at timestamptz;

create unique index if not exists reviews_ticketing_order_property_unique_idx
  on public.reviews(ticketing_order_id, property_id)
  where ticketing_order_id is not null;

-- Public attraction pages must be able to read published reviews while writes
-- remain controlled by existing policies or the tokenized verified flow below.
drop policy if exists "Anyone can view reviews" on public.reviews;
drop policy if exists reviews_public_select on public.reviews;
create policy reviews_public_select
on public.reviews for select
to anon, authenticated
using (
  exists (
    select 1
    from public.properties property
    where property.id = reviews.property_id
      and property.is_active = true
  )
);

create table if not exists public.review_invitations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  token uuid not null default gen_random_uuid() unique,
  recipient_email text not null,
  recipient_name text,
  status text not null default 'pending'
    check (status in ('pending','sent','completed','expired')),
  available_after timestamptz not null,
  sent_at timestamptz,
  completed_at timestamptz,
  provider_message_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(order_id, property_id)
);

create index if not exists review_invitations_delivery_idx
  on public.review_invitations(status, available_after, sent_at);

alter table public.review_invitations enable row level security;
revoke all on public.review_invitations from public, anon, authenticated;
grant all on public.review_invitations to service_role;

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
  on conflict (order_id, property_id) do nothing;

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

create or replace function public.review_invitation_get(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((
    select jsonb_build_object(
      'valid', true,
      'eligible',
        invitation.status in ('pending','sent')
        and invitation.available_after <= now()
        and customer_order.status = 'confirmed'
        and customer_order.payment_status = 'paid'
        and exists (
          select 1
          from public.tickets ticket
          where ticket.order_id = customer_order.id
            and ticket.status = 'used'
            and ticket.used_at is not null
        ),
      'completed', invitation.status = 'completed',
      'propertyId', property.id,
      'propertyTitle', property.title,
      'propertyCity', property.city,
      'recipientName', invitation.recipient_name,
      'availableAfter', invitation.available_after
    )
    from public.review_invitations invitation
    join public.orders customer_order on customer_order.id = invitation.order_id
    join public.properties property on property.id = invitation.property_id
    where invitation.token = p_token
      and invitation.status <> 'expired'
      and property.is_active = true
    limit 1
  ), jsonb_build_object('valid', false, 'eligible', false, 'completed', false));
$$;

revoke all on function public.review_invitation_get(uuid) from public;
grant execute on function public.review_invitation_get(uuid) to anon, authenticated;

create or replace function public.review_submit_verified(
  p_token uuid,
  p_rating integer,
  p_comment text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  invitation public.review_invitations%rowtype;
  customer_order public.orders%rowtype;
  review_id uuid;
  normalized_comment text := btrim(coalesce(p_comment, ''));
begin
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'Rating must be between 1 and 5' using errcode = '22023';
  end if;

  if length(normalized_comment) < 3 or length(normalized_comment) > 2000 then
    raise exception 'Comment must contain between 3 and 2000 characters' using errcode = '22023';
  end if;

  select * into invitation
  from public.review_invitations
  where token = p_token
  for update;

  if not found or invitation.status = 'expired' then
    raise exception 'Review invitation is invalid' using errcode = 'P0002';
  end if;

  if invitation.available_after > now() then
    raise exception 'Review invitation is not active yet' using errcode = '42501';
  end if;

  select * into customer_order
  from public.orders
  where id = invitation.order_id
    and status = 'confirmed'
    and payment_status = 'paid';

  if not found then
    raise exception 'Paid order required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.tickets ticket
    where ticket.order_id = customer_order.id
      and ticket.status = 'used'
      and ticket.used_at is not null
  ) then
    raise exception 'Redeemed ticket required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.venues venue
    where venue.id = customer_order.venue_id
      and venue.property_id = invitation.property_id
  ) then
    raise exception 'Order does not match this attraction' using errcode = '42501';
  end if;

  select id into review_id
  from public.reviews
  where ticketing_order_id = customer_order.id
    and property_id = invitation.property_id
  limit 1;

  if review_id is null then
    insert into public.reviews (
      property_id,
      guest_id,
      ticketing_order_id,
      rating,
      comment,
      author_name,
      verified_visit,
      verified_at
    ) values (
      invitation.property_id,
      customer_order.customer_user_id,
      customer_order.id,
      p_rating,
      normalized_comment,
      coalesce(nullif(btrim(customer_order.customer_name), ''), 'Gość EnjoyHub'),
      true,
      now()
    )
    returning id into review_id;
  end if;

  update public.review_invitations
     set status = 'completed',
         completed_at = coalesce(completed_at, now()),
         updated_at = now()
   where id = invitation.id;

  return review_id;
end;
$$;

revoke all on function public.review_submit_verified(uuid,integer,text) from public;
grant execute on function public.review_submit_verified(uuid,integer,text) to anon, authenticated;
