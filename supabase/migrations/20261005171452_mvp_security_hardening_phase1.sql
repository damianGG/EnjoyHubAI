-- EnjoyHub MVP security hardening, phase 1.
-- Keep this migration safe for both the existing production database and
-- fresh/test databases where legacy dev_* objects may already be absent.

do $$
declare
  legacy_table text;
begin
  foreach legacy_table in array array[
    'dev_users',
    'dev_categories',
    'dev_properties',
    'dev_bookings',
    'dev_reviews',
    'dev_favorites'
  ]
  loop
    if to_regclass(format('public.%I', legacy_table)) is not null then
      execute format(
        'revoke all privileges on table public.%I from public, anon, authenticated',
        legacy_table
      );
    end if;
  end loop;
end
$$;

-- Platform admin RPCs are for signed-in platform staff only.
-- Keep explicit authenticated/service_role grants and remove inherited/public
-- anonymous execution. The catalog-driven loop is a no-op if no matching
-- functions exist in a fresh/test database.
do $$
declare
  admin_function regprocedure;
begin
  for admin_function in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname like 'platform_admin_%'
  loop
    execute format(
      'revoke execute on function %s from public, anon',
      admin_function
    );
  end loop;
end
$$;
