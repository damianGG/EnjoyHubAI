-- Run after the stage 2B marketplace bridge migration. The transaction rolls
-- back the property link, product, order and hold created by this smoke test.

begin;

do $ticketing_marketplace_bridge_smoke$
declare
  test_user_id uuid;
  other_user_id uuid := gen_random_uuid();
  property_id uuid := gen_random_uuid();
  other_property_id uuid := gen_random_uuid();
  suffix text := left(replace(gen_random_uuid()::text, '-', ''), 12);
  setup_result record;
  first_session_id uuid;
  first_ticket_type_id uuid;
  calendar_state record;
  checkout_result record;
  unauthorized_link_blocked boolean := false;
  foreign_property_blocked boolean := false;
begin
  select auth_user.id
    into test_user_id
    from auth.users auth_user
    join public.users profile on profile.id = auth_user.id
   order by auth_user.created_at
   limit 1;

  if test_user_id is null then
    raise exception 'Stage 2B smoke test requires a matching Auth and public user';
  end if;

  insert into public.properties (
    id,
    host_id,
    title,
    property_type,
    address,
    city,
    country,
    price_per_night,
    is_active
  ) values (
    property_id,
    test_user_id,
    'Stage 2B Marketplace Property',
    'attraction',
    'Testowa 2',
    'Warszawa',
    'Polska',
    49,
    true
  );

  perform set_config('request.jwt.claim.sub', test_user_id::text, true);

  select *
    into setup_result
    from public.ticketing_create_marketplace_sales_setup(
      null,
      null,
      'Stage 2B Smoke Organization',
      'Stage 2B Marketplace Property',
      'stage-2b-venue-' || suffix,
      'Venue linked to a public marketplace property.',
      'Testowa 2',
      '00-002',
      'Warszawa',
      'allocated_quota',
      'Stage 2B Ticket Product',
      'stage-2b-product-' || suffix,
      'Ticket product visible in the marketplace calendar.',
      60,
      jsonb_build_array(jsonb_build_object(
        'name', 'Bilet normalny',
        'price_amount', 49,
        'capacity_units', 1,
        'max_quantity_per_order', 10
      )),
      array[1, 2, 3, 4, 5, 6, 7]::smallint[],
      '10:00',
      '11:00',
      60,
      20,
      0,
      current_date + 6,
      property_id
    );

  if not exists (
    select 1
    from public.venues venue
    where venue.id = setup_result.created_venue_id
      and venue.property_id = property_id
  ) then
    raise exception 'Marketplace setup did not link the venue and property';
  end if;

  select session.id
    into first_session_id
    from public.sessions session
    where session.product_id = setup_result.created_product_id
      and session.starts_at > now()
    order by session.starts_at
    limit 1;

  select ticket.id
    into first_ticket_type_id
    from public.ticket_types ticket
    where ticket.product_id = setup_result.created_product_id
    limit 1;

  select *
    into calendar_state
    from public.ticketing_list_property_sessions(
      property_id,
      current_date,
      current_date + 6
    ) calendar
    where calendar.session_id = first_session_id;

  if calendar_state.session_id is null
     or calendar_state.available_capacity_units <> 20
     or calendar_state.price_from <> 49
     or calendar_state.currency <> 'PLN' then
    raise exception 'Marketplace calendar returned invalid initial availability';
  end if;

  select *
    into checkout_result
    from public.ticketing_create_order_hold(
      gen_random_uuid(),
      first_session_id,
      'Stage 2B Customer',
      'stage-2b-customer@example.com',
      jsonb_build_array(jsonb_build_object(
        'ticket_type_id', first_ticket_type_id,
        'quantity', 1
      )),
      null,
      null,
      'enjoyhub_marketplace',
      15,
      true,
      '{"smoke_test":"stage_2b"}'::jsonb
    );

  select *
    into calendar_state
    from public.ticketing_list_property_sessions(
      property_id,
      current_date,
      current_date + 6
    ) calendar
    where calendar.session_id = first_session_id;

  if calendar_state.available_capacity_units <> 19 then
    raise exception 'Marketplace calendar did not include the active inventory hold';
  end if;

  insert into auth.users (id, email)
  values (other_user_id, 'stage-2b-other@example.com');
  insert into public.users (id, email, full_name)
  values (other_user_id, 'stage-2b-other@example.com', 'Stage 2B Other User');
  insert into public.properties (
    id,
    host_id,
    title,
    property_type,
    address,
    city,
    country,
    price_per_night,
    is_active
  ) values (
    other_property_id,
    other_user_id,
    'Other Property',
    'attraction',
    'Inna 1',
    'Kraków',
    'Polska',
    10,
    true
  );

  perform set_config('request.jwt.claim.sub', other_user_id::text, true);
  begin
    perform public.ticketing_link_venue_property(
      setup_result.created_venue_id,
      other_property_id
    );
  exception
    when others then
      if sqlstate = '42501' then
        unauthorized_link_blocked := true;
      else
        raise;
      end if;
  end;

  if not unauthorized_link_blocked then
    raise exception 'A non-member linked a property to another organization venue';
  end if;

  perform set_config('request.jwt.claim.sub', test_user_id::text, true);
  begin
    perform public.ticketing_link_venue_property(
      setup_result.created_venue_id,
      other_property_id
    );
  exception
    when others then
      if sqlstate = '42501' then
        foreign_property_blocked := true;
      else
        raise;
      end if;
  end;

  if not foreign_property_blocked then
    raise exception 'A venue manager linked a marketplace property owned by another user';
  end if;

  insert into public.organization_memberships (organization_id, user_id, role)
  values (setup_result.created_organization_id, other_user_id, 'manager');
  perform set_config('request.jwt.claim.sub', other_user_id::text, true);

  perform public.ticketing_link_venue_property(
    setup_result.created_venue_id,
    property_id
  );

  if not exists (
    select 1
    from public.venues venue
    where venue.id = setup_result.created_venue_id
      and venue.property_id = property_id
  ) then
    raise exception 'A venue manager could not preserve the existing marketplace link';
  end if;

  if has_column_privilege('authenticated', 'public.venues', 'property_id', 'INSERT')
     or has_column_privilege('authenticated', 'public.venues', 'property_id', 'UPDATE') then
    raise exception 'authenticated must link marketplace properties only through the validated function';
  end if;

  if exists (
    select 1
    from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname in (
        'ticketing_link_venue_property',
        'ticketing_create_marketplace_sales_setup'
      )
      and has_function_privilege('anon', procedure.oid, 'EXECUTE')
  ) then
    raise exception 'anon must not manage marketplace venue links';
  end if;

  if not exists (
    select 1
    from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname = 'ticketing_list_property_sessions'
      and has_function_privilege('anon', procedure.oid, 'EXECUTE')
  ) then
    raise exception 'anon must read public marketplace ticketing sessions';
  end if;

  if (
    select count(*)
    from pg_policies configured_policy
    where configured_policy.schemaname = 'public'
      and configured_policy.policyname in (
        'venues_select_order_customers',
        'sessions_select_order_customers'
      )
  ) <> 2 then
    raise exception 'Customer order history policies are missing';
  end if;
end
$ticketing_marketplace_bridge_smoke$;

rollback;
