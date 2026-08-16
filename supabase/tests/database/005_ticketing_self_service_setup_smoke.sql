-- Run after the stage 2A migration. The transaction rolls back the complete
-- self-service configuration and does not leave organizations or sessions.

begin;

do $ticketing_self_service_setup_smoke$
declare
  test_user_id uuid;
  other_user_id uuid := gen_random_uuid();
  test_slug_suffix text := left(replace(gen_random_uuid()::text, '-', ''), 12);
  setup_result record;
  extension_result record;
  stored_state record;
  stored_ticket_count integer;
  stored_schedule_count integer;
  stored_session_count integer;
  unauthorized_setup_blocked boolean := false;
begin
  select id
    into test_user_id
    from auth.users
   order by created_at
   limit 1;

  if test_user_id is null then
    raise exception 'Stage 2A smoke test requires at least one Auth user';
  end if;

  perform set_config('request.jwt.claim.sub', test_user_id::text, true);

  select *
    into setup_result
    from public.ticketing_create_sales_setup(
      null,
      null,
      'Stage 2A Smoke Organization',
      'Stage 2A Smoke Venue',
      'stage-2a-venue-' || test_slug_suffix,
      'Venue created atomically by the stage 2A smoke test.',
      'Testowa 1',
      '00-001',
      'Warszawa',
      'allocated_quota',
      'Stage 2A Smoke Product',
      'stage-2a-product-' || test_slug_suffix,
      'A complete self-service ticket offer.',
      60,
      jsonb_build_array(
        jsonb_build_object(
          'name', 'Bilet normalny',
          'price_amount', 50,
          'capacity_units', 1,
          'max_quantity_per_order', 10
        ),
        jsonb_build_object(
          'name', 'Bilet rodzinny',
          'price_amount', 120,
          'capacity_units', 3,
          'max_quantity_per_order', 4
        )
      ),
      array[1, 2, 3, 4, 5, 6, 7]::smallint[],
      '10:00',
      '12:00',
      60,
      20,
      60,
      current_date + 6
    );

  if setup_result.created_organization_id is null
     or setup_result.created_venue_id is null
     or setup_result.created_product_id is null
     or setup_result.generated_session_count <> 14 then
    raise exception 'Self-service setup returned an invalid result';
  end if;

  select
    organization.status as organization_status,
    membership.role as member_role,
    venue.status as venue_status,
    venue.sales_mode,
    product.status as product_status,
    product.inventory_mode
    into stored_state
    from public.organizations organization
    join public.organization_memberships membership
      on membership.organization_id = organization.id
     and membership.user_id = test_user_id
    join public.venues venue
      on venue.organization_id = organization.id
    join public.products product
      on product.venue_id = venue.id
   where organization.id = setup_result.created_organization_id
     and venue.id = setup_result.created_venue_id
     and product.id = setup_result.created_product_id;

  if stored_state.organization_status <> 'active'
     or stored_state.member_role <> 'owner'
     or stored_state.venue_status <> 'active'
     or stored_state.sales_mode <> 'allocated_quota'
     or stored_state.product_status <> 'active'
     or stored_state.inventory_mode <> 'allocated_quota' then
    raise exception 'Created setup is not active or owner-scoped';
  end if;

  select count(*)::integer
    into stored_ticket_count
    from public.ticket_types
   where product_id = setup_result.created_product_id;

  select count(*)::integer
    into stored_schedule_count
    from public.product_schedules
   where product_id = setup_result.created_product_id;

  select count(*)::integer
    into stored_session_count
    from public.sessions
   where product_id = setup_result.created_product_id;

  if stored_ticket_count <> 2
     or stored_schedule_count <> 7
     or stored_session_count <> 14 then
    raise exception 'Setup did not create prices, schedules and sessions atomically';
  end if;

  select *
    into extension_result
    from public.ticketing_extend_active_sessions(current_date + 13, 100);

  if extension_result.processed_product_count < 1
     or extension_result.generated_session_count <> 14 then
    raise exception 'Automatic session extension returned an invalid result';
  end if;

  select count(*)::integer
    into stored_session_count
    from public.sessions
   where product_id = setup_result.created_product_id;

  if stored_session_count <> 28 then
    raise exception 'Automatic session extension did not materialize future inventory';
  end if;

  insert into auth.users (id, email)
  values (other_user_id, 'stage-2a-unauthorized@example.com');
  perform set_config('request.jwt.claim.sub', other_user_id::text, true);

  begin
    perform public.ticketing_create_sales_setup(
      setup_result.created_organization_id,
      null,
      null,
      'Unauthorized Venue',
      'stage-2a-unauthorized-venue-' || test_slug_suffix,
      null,
      null,
      null,
      null,
      'allocated_quota',
      'Unauthorized Product',
      'stage-2a-unauthorized-product-' || test_slug_suffix,
      null,
      60,
      jsonb_build_array(jsonb_build_object(
        'name', 'Bilet',
        'price_amount', 10,
        'capacity_units', 1,
        'max_quantity_per_order', 2
      )),
      array[1]::smallint[],
      '10:00',
      '12:00',
      60,
      10,
      60,
      current_date + 7
    );
  exception
    when others then
      if sqlstate = '42501' then
        unauthorized_setup_blocked := true;
      else
        raise;
      end if;
  end;

  if not unauthorized_setup_blocked then
    raise exception 'A non-member configured sales in another organization';
  end if;

  if exists (
    select 1
    from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname = 'ticketing_create_sales_setup'
      and has_function_privilege('anon', procedure.oid, 'EXECUTE')
  ) then
    raise exception 'anon must not execute self-service setup';
  end if;

  if not exists (
    select 1
    from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname = 'ticketing_create_sales_setup'
      and has_function_privilege('authenticated', procedure.oid, 'EXECUTE')
  ) then
    raise exception 'authenticated managers must execute self-service setup';
  end if;

  if exists (
    select 1
    from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname = 'ticketing_extend_active_sessions'
      and has_function_privilege('authenticated', procedure.oid, 'EXECUTE')
  ) or not exists (
    select 1
    from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname = 'ticketing_extend_active_sessions'
      and has_function_privilege('service_role', procedure.oid, 'EXECUTE')
  ) then
    raise exception 'Only service_role may extend every product automatically';
  end if;
end
$ticketing_self_service_setup_smoke$;

rollback;
