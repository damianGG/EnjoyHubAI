-- Supabase installs pgcrypto in the extensions schema. Qualify the crypto helpers
-- used by invitation token generation and hashing.

begin;

do $$
declare
  function_record record;
  function_definition text;
begin
  for function_record in
    select p.oid
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in (
         'ticketing_create_organization_invitation',
         'ticketing_get_organization_invitation',
         'ticketing_accept_organization_invitation'
       )
  loop
    function_definition := pg_get_functiondef(function_record.oid);
    function_definition := replace(function_definition, 'gen_random_bytes(32)', 'extensions.gen_random_bytes(32)');
    function_definition := replace(function_definition, 'digest(raw_token, ''sha256'')', 'extensions.digest(raw_token, ''sha256'')');
    function_definition := replace(function_definition, 'digest(coalesce(p_token, ''''), ''sha256'')', 'extensions.digest(coalesce(p_token, ''''), ''sha256'')');
    execute function_definition;
  end loop;
end
$$;

commit;
