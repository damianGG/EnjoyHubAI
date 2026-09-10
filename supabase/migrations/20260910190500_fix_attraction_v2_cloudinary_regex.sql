-- Correct the escaped Cloudinary host regexp introduced in the v2 attraction RPC.
-- The previous source contained two backslashes before each dot, which matches a
-- literal backslash instead of a literal dot with standard_conforming_strings.

begin;

do $$
declare
  function_oid oid;
  function_definition text;
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

  if position($old$^https://res\\.cloudinary\\.com/$old$ in function_definition) = 0 then
    raise exception 'Expected escaped Cloudinary regexp was not found';
  end if;

  function_definition := replace(
    function_definition,
    $old$^https://res\\.cloudinary\\.com/$old$,
    $new$^https://res[.]cloudinary[.]com/$new$
  );

  execute function_definition;
end
$$;

commit;
