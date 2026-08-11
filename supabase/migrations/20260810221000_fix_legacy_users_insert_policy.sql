-- The legacy script 05 created a policy named "Service role can insert users"
-- without restricting it to service_role. Because service_role bypasses RLS,
-- that permissive policy is unnecessary and lets authenticated users insert a
-- profile for any UUID. Keep only the existing own-profile policy.

begin;

-- The guard keeps a fresh canonical-only Supabase database deployable even
-- before the legacy application tables are baselined.
do $$
begin
  if to_regclass('public.users') is not null then
    execute 'drop policy if exists "Service role can insert users" on public.users';
    execute 'drop policy if exists "Users can insert their own profile" on public.users';
    execute $policy$
      create policy "Users can insert their own profile"
      on public.users
      for insert
      to authenticated
      with check (auth.uid() = id)
    $policy$;
  end if;
end
$$;

commit;
