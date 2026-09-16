do $$
declare
  fn record;
  original_ddl text;
  hardened_ddl text;
begin
  for fn in
    select proc.oid, proc.proname
    from pg_proc proc
    join pg_namespace namespace on namespace.oid = proc.pronamespace
    where namespace.nspname = 'public'
      and proc.prokind = 'f'
      and (
        proc.proname like 'platform_supply_%'
        or proc.proname like 'platform_admin_%'
      )
  loop
    original_ddl := pg_get_functiondef(fn.oid);
    hardened_ddl := original_ddl;

    hardened_ddl := replace(
      hardened_ddl,
      'if actor_id is null or actor_role not in (',
      'if actor_id is null or actor_role is null or actor_role not in ('
    );
    hardened_ddl := replace(
      hardened_ddl,
      'if staff_role not in (',
      'if staff_role is null or staff_role not in ('
    );
    hardened_ddl := replace(
      hardened_ddl,
      'if actor_id is null or actor_role <> ',
      'if actor_id is null or actor_role is null or actor_role <> '
    );

    if hardened_ddl <> original_ddl then
      execute hardened_ddl;
    end if;
  end loop;
end;
$$;

-- Keep the role probe nullable for UI authorization checks, but do not expose it anonymously.
revoke all on function public.platform_current_staff_role() from public, anon;
grant execute on function public.platform_current_staff_role() to authenticated;
