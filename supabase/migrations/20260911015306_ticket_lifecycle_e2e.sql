-- Point 11: complete and harden the order -> payment -> ticket -> admission lifecycle.
-- Cashiers can redeem tickets through the dedicated RPC, but they must not gain
-- broad access to customer/order/payment data through generic RLS policies.

begin;

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
         or public.ticketing_is_org_member(
           customer_order.organization_id,
           array['owner', 'admin', 'manager', 'viewer']::public.ticketing_member_role[]
         )
       )
  );
$$;

revoke all on function public.ticketing_can_read_order(uuid) from public, anon;
grant execute on function public.ticketing_can_read_order(uuid) to authenticated, service_role;

drop policy if exists orders_select_customer_or_members on public.orders;
create policy orders_select_customer_or_sales_members
on public.orders
for select
to authenticated
using (
  customer_user_id = auth.uid()
  or public.ticketing_is_org_member(
    organization_id,
    array['owner', 'admin', 'manager', 'viewer']::public.ticketing_member_role[]
  )
);

-- One bounded, role-aware read model for the organizer order details screen.
-- It deliberately exposes customer data only to sales roles and never to cashier.
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

  select *
    into order_row
    from public.orders
   where id = p_order_id;

  if not found then
    raise exception 'Order does not exist' using errcode = 'P0002';
  end if;

  if not public.ticketing_is_org_member(
    order_row.organization_id,
    array['owner', 'admin', 'manager', 'viewer']::public.ticketing_member_role[]
  ) then
    raise exception 'User cannot view this order' using errcode = '42501';
  end if;

  select * into venue_row from public.venues where id = order_row.venue_id;

  result := jsonb_build_object(
    'order', jsonb_build_object(
      'id', order_row.id,
      'orderNumber', order_row.order_number,
      'status', order_row.status,
      'paymentStatus', order_row.payment_status,
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
          'productName', item.product_name,
          'ticketTypeName', item.ticket_type_name,
          'quantity', item.quantity,
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
    ), '[]'::jsonb)
  );

  return result;
end;
$$;

revoke all on function public.ticketing_get_organizer_order_lifecycle(uuid) from public, anon;
grant execute on function public.ticketing_get_organizer_order_lifecycle(uuid) to authenticated, service_role;

commit;
