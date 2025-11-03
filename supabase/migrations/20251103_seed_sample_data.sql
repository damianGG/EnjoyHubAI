-- Seed przykładowych atrybutów
insert into public.attribute_definitions (key, label, type, category_slug, options, active, sort_order) values
  ('parking', 'Parking', 'enum', null, '["free","paid","none"]'::jsonb, true, 10),
  ('outdoor', 'Na świeżym powietrzu', 'boolean', null, null, true, 20),
  ('accessible', 'Dostępność dla niepełnosprawnych', 'boolean', null, null, true, 30),
  ('kids_min', 'Wiek od', 'number', null, null, true, 40),
  ('kids_max', 'Wiek do', 'number', null, null, true, 50)
on conflict do nothing;

-- Seed przykładowych miejsc
insert into public.places (name, description, category_slug, city, region, lat, lng, has_online_booking, price_min, price_max, rating, reviews_count, attributes)
values
  (
    'Paintball Kampinos',
    'Leśne pole paintballowe z kilkoma scenariuszami gry',
    'paintball',
    'Warszawa',
    'Mazowieckie',
    52.324, 20.592,
    true,
    50, 120,
    4.5,
    87,
    '{"parking":"free","outdoor":true,"accessible":false,"kids_min":10,"kids_max":18}'::jsonb
  ),
  (
    'Gokarty Kraków Arena',
    'Szybki tor halowy z nowymi gokartami',
    'gokarty',
    'Kraków',
    'Małopolskie',
    50.061, 19.938,
    false,
    30, 90,
    4.2,
    142,
    '{"parking":"paid","outdoor":false,"accessible":true,"kids_min":8,"kids_max":16}'::jsonb
  ),
  (
    'Escape Room Stare Miasto',
    'Zagadki inspirowane historią miasta',
    'escape-room',
    'Gdańsk',
    'Pomorskie',
    54.352, 18.646,
    true,
    40, 150,
    4.7,
    203,
    '{"parking":"none","outdoor":false,"accessible":true,"kids_min":12,"kids_max":99}'::jsonb
  )
on conflict do nothing;
