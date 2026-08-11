-- Run after applying the migrations to staging. The transaction never changes
-- application data; any failed assertion aborts with a descriptive error.

begin;

do $ticketing_core_smoke$
declare
  expected_table text;
  secured_table text;
begin
  foreach expected_table in array array[
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
    if to_regclass('public.' || expected_table) is null then
      raise exception 'Missing ticketing table: public.%', expected_table;
    end if;
  end loop;

  foreach secured_table in array array[
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
    if not exists (
      select 1
      from pg_class relation
      join pg_namespace namespace on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public'
        and relation.relname = secured_table
        and relation.relrowsecurity
    ) then
      raise exception 'RLS is not enabled on public.%', secured_table;
    end if;
  end loop;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'users'
      and policyname = 'Service role can insert users'
  ) then
    raise exception 'Unsafe legacy users INSERT policy still exists';
  end if;

  if has_table_privilege('anon', 'public.orders', 'INSERT') then
    raise exception 'anon must not insert orders directly';
  end if;

  if has_table_privilege('authenticated', 'public.orders', 'INSERT') then
    raise exception 'authenticated must not insert orders directly';
  end if;

  if not has_table_privilege('anon', 'public.sessions', 'SELECT') then
    raise exception 'anon should be able to read public sessions through RLS';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgname = 'ticketing_organizations_add_owner'
      and not tgisinternal
  ) then
    raise exception 'Organization owner trigger is missing';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgname = 'ticketing_venues_validate_timezone'
      and not tgisinternal
  ) then
    raise exception 'Venue timezone validation trigger is missing';
  end if;
end
$ticketing_core_smoke$;

rollback;
