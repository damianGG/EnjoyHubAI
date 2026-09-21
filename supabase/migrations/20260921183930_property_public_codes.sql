create or replace function public.marketplace_property_public_code(p_id uuid)
returns text
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  alphabet constant text := '0123456789abcdefghjkmnpqrstvwxyz';
  hex_value text := replace(p_id::text, '-', '');
  numeric_value bigint := 0;
  result_code text := '';
  position integer;
  digit integer;
begin
  for position in 1..13 loop
    digit := strpos('0123456789abcdef', substr(hex_value, position, 1)) - 1;
    numeric_value := numeric_value * 16 + digit;
  end loop;

  numeric_value := numeric_value / 4;

  for position in 1..10 loop
    result_code := substr(alphabet, (numeric_value % 32)::integer + 1, 1) || result_code;
    numeric_value := numeric_value / 32;
  end loop;

  return result_code;
end;
$$;

alter table public.properties
  add column if not exists public_code text
  generated always as (public.marketplace_property_public_code(id)) stored;

create unique index if not exists properties_public_code_key
  on public.properties (public_code);

comment on column public.properties.public_code is
  'Stable short public identifier derived from the internal UUID for canonical marketplace URLs.';
