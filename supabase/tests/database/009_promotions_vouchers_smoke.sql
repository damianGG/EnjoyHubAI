-- P1 promotions/vouchers smoke test.
begin;

do $p1_promotions_smoke$
declare
  user_id uuid;
  org_id uuid := gen_random_uuid();
  venue_id uuid := gen_random_uuid();
  product_id uuid := gen_random_uuid();
  ticket_id uuid := gen_random_uuid();
  session_id uuid := gen_random_uuid();
  promotion_id uuid;
  checkout_key uuid := gen_random_uuid();
  checkout_result record;
  retry_result record;
  quote jsonb;
  stored_order record;
  failed_as_expected boolean := false;
begin
  select u.id into user_id
  from auth.users u
  join public.users p on p.id = u.id
  order by u.created_at
  limit 1;

  if user_id is null then
    raise exception 'P1 smoke requires an auth/public user';
  end if;

  perform set_config('request.jwt.claim.sub', user_id::text, true);

  insert into public.organizations (id, name, created_by)
  values (org_id, 'P1 Promotions Test', user_id);

  insert into public.organization_memberships (organization_id, user_id, role)
  values (org_id, user_id, 'owner');

  insert into public.venues (
    id, organization_id, name, slug, city, status, created_by
  ) values (
    venue_id, org_id, 'P1 Venue', 'p1-venue-' || left(org_id::text, 8),
    'Kraków', 'active', user_id
  );

  insert into public.products (
    id, venue_id, name, slug, duration_minutes, min_participants,
    max_participants, inventory_mode, status, created_by
  ) values (
    product_id, venue_id, 'P1 Product', 'p1-product-' || left(product_id::text, 8),
    60, 1, 10, 'allocated_quota', 'active', user_id
  );

  insert into public.ticket_types (
    id, product_id, name, price_amount, currency, capacity_units,
    min_quantity_per_order, max_quantity_per_order, is_active
  ) values (
    ticket_id, product_id, 'Normalny', 50, 'PLN', 1, 1, 10, true
  );

  insert into public.sessions (
    id, product_id, starts_at, ends_at, capacity, status
  ) values (
    session_id, product_id,
    statement_timestamp() + interval '3 hours',
    statement_timestamp() + interval '4 hours',
    10, 'scheduled'
  );

  promotion_id := public.ticketing_create_promotion(
    org_id,
    'P1 20 procent',
    'P1TEST20',
    'promotion',
    'percentage',
    20,
    null,
    50,
    10,
    1,
    null,
    null,
    product_id,
    null,
    null
  );

  quote := public.ticketing_quote_promotion(
    session_id,
    'p1test20',
    jsonb_build_array(jsonb_build_object(
      'ticket_type_id', ticket_id,
      'quantity', 2
    )),
    'customer@example.com',
    null
  );

  if (quote ->> 'discountAmount')::numeric <> 20
     or (quote ->> 'totalAmount')::numeric <> 80 then
    raise exception 'Promotion quote calculated wrong totals: %', quote;
  end if;

  select * into checkout_result
  from public.ticketing_create_order_hold_with_promotion(
    checkout_key,
    session_id,
    'P1 Customer',
    'customer@example.com',
    jsonb_build_array(jsonb_build_object(
      'ticket_type_id', ticket_id,
      'quantity', 2
    )),
    null,
    null,
    'enjoyhub_marketplace',
    15,
    true,
    '{}'::jsonb,
    'P1TEST20'
  );

  select subtotal_amount, discount_amount, total_amount
  into stored_order
  from public.orders
  where id = checkout_result.created_order_id;

  if stored_order.subtotal_amount <> 100
     or stored_order.discount_amount <> 20
     or stored_order.total_amount <> 80 then
    raise exception 'Promotion was not persisted on order';
  end if;

  if (select count(*) from public.promotion_redemptions
      where order_id = checkout_result.created_order_id) <> 1 then
    raise exception 'Promotion redemption snapshot missing';
  end if;

  select * into retry_result
  from public.ticketing_create_order_hold_with_promotion(
    checkout_key,
    session_id,
    'P1 Customer',
    'customer@example.com',
    jsonb_build_array(jsonb_build_object(
      'ticket_type_id', ticket_id,
      'quantity', 2
    )),
    null,
    null,
    'enjoyhub_marketplace',
    15,
    true,
    '{}'::jsonb,
    'P1TEST20'
  );

  if retry_result.created_order_id <> checkout_result.created_order_id
     or (select count(*) from public.promotion_redemptions
         where order_id = checkout_result.created_order_id) <> 1 then
    raise exception 'Promotion checkout retry is not idempotent';
  end if;

  begin
    perform public.ticketing_create_order_hold_with_promotion(
      gen_random_uuid(),
      session_id,
      'P1 Customer',
      'customer@example.com',
      jsonb_build_array(jsonb_build_object(
        'ticket_type_id', ticket_id,
        'quantity', 1
      )),
      null,
      null,
      'enjoyhub_marketplace',
      15,
      true,
      '{}'::jsonb,
      'P1TEST20'
    );
  exception
    when sqlstate 'P0001' then
      failed_as_expected := true;
  end;

  if not failed_as_expected then
    raise exception 'Per-customer promotion limit was not enforced';
  end if;
end;
$p1_promotions_smoke$;

rollback;
