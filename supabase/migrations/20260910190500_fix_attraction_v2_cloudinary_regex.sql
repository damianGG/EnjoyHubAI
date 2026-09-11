-- Correct the escaped Cloudinary host regexp introduced in the v2 attraction RPC.
-- Replace the whole regexp literal in the stored function definition so the
-- migration is robust to how PostgreSQL renders backslashes in pg_get_functiondef.

begin;

do $$
declare
  function_oid oid;
  function_definition text;
  corrected_definition text;
begin
  select p.oid
    into function_oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'ticketing_add_organizer_attraction_v2'
   limit 1;

  if function_oid is null then
    raise exception 'ticketing_add_organizer_attraction_v2 is missing';
  end if;

  function_definition := pg_get_functiondef(function_oid);
  corrected_definition := regexp_replace(
    function_definition,
    $rx$\^https://res[^']*cloudinary[^']*com/$rx$,
    $new$^https://res[.]cloudinary[.]com/$new$
  );

  if corrected_definition = function_definition then
    raise exception 'Cloudinary regexp was not found in attraction v2 function';
  end if;

  execute corrected_definition;
end
$$;

commit;
