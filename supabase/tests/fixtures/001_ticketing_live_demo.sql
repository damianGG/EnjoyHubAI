-- STAGING ONLY: creates one visible offer and future session for /checkout.
-- The fixed UUIDs make the script safe to run again without adding duplicates.

begin;

do $ticketing_live_demo$
declare
  owner_user_id uuid;
  demo_starts_at timestamptz := date_trunc('day', now()) + interval '7 days 16 hours';
begin
  select id into owner_user_id
  from auth.users
  order by created_at
  limit 1;

  if owner_user_id is null then
    raise exception 'Create at least one Auth user before adding the live demo';
  end if;

  insert into public.organizations (id, name, created_by)
  values (
    '11111111-1111-4111-8111-111111111101',
    'EnjoyHub Demo',
    owner_user_id
  )
  on conflict (id) do update set name = excluded.name;

  insert into public.venues (
    id,
    organization_id,
    name,
    slug,
    description,
    address_line_1,
    postal_code,
    city,
    timezone,
    sales_mode,
    status,
    created_by
  ) values (
    '11111111-1111-4111-8111-111111111102',
    '11111111-1111-4111-8111-111111111101',
    'Park Przygody EnjoyHub',
    'park-przygody-enjoyhub-demo',
    'Testowy obiekt do sprawdzania sprzedaży biletów.',
    'ul. Testowa 10',
    '39-120',
    'Sędziszów Małopolski',
    'Europe/Warsaw',
    'allocated_quota',
    'active',
    owner_user_id
  )
  on conflict (id) do update set
    name = excluded.name,
    description = excluded.description,
    status = excluded.status;

  insert into public.products (
    id,
    venue_id,
    name,
    slug,
    description,
    duration_minutes,
    min_participants,
    max_participants,
    inventory_mode,
    status,
    created_by
  ) values (
    '11111111-1111-4111-8111-111111111103',
    '11111111-1111-4111-8111-111111111102',
    'Rodzinna przygoda w parku',
    'rodzinna-przygoda-demo',
    'Pełna atrakcji godzina dla dzieci i dorosłych. Oferta służy do testowania nowego checkoutu EnjoyHub.',
    60,
    1,
    8,
    'allocated_quota',
    'active',
    owner_user_id
  )
  on conflict (id) do update set
    name = excluded.name,
    description = excluded.description,
    status = excluded.status;

  insert into public.ticket_types (
    id,
    product_id,
    name,
    description,
    price_amount,
    currency,
    capacity_units,
    min_quantity_per_order,
    max_quantity_per_order,
    sort_order,
    is_active
  ) values
    (
      '11111111-1111-4111-8111-111111111104',
      '11111111-1111-4111-8111-111111111103',
      'Bilet normalny',
      'Dla jednej osoby.',
      69,
      'PLN',
      1,
      1,
      8,
      10,
      true
    ),
    (
      '11111111-1111-4111-8111-111111111105',
      '11111111-1111-4111-8111-111111111103',
      'Bilet rodzinny',
      'Dla maksymalnie czterech osób.',
      199,
      'PLN',
      4,
      1,
      2,
      20,
      true
    )
  on conflict (id) do update set
    name = excluded.name,
    description = excluded.description,
    price_amount = excluded.price_amount,
    capacity_units = excluded.capacity_units,
    is_active = excluded.is_active;

  insert into public.sessions (
    id,
    product_id,
    starts_at,
    ends_at,
    capacity,
    sales_ends_at,
    status
  ) values (
    '11111111-1111-4111-8111-111111111106',
    '11111111-1111-4111-8111-111111111103',
    demo_starts_at,
    demo_starts_at + interval '1 hour',
    8,
    demo_starts_at - interval '30 minutes',
    'scheduled'
  )
  on conflict (id) do update set
    starts_at = excluded.starts_at,
    ends_at = excluded.ends_at,
    capacity = excluded.capacity,
    sales_ends_at = excluded.sales_ends_at,
    status = excluded.status;
end
$ticketing_live_demo$;

commit;
