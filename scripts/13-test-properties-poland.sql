-- Test data: 40 properties in Poland for search and map testing
-- This script adds realistic test properties with actual Polish city coordinates
-- Distributed across all categories: paintball, gokarty, trampoliny, place-zabaw, restauracje-dzieci, ekstremalne

-- First, ensure we have a test host user
INSERT INTO users (id, email, full_name, is_host, is_verified, created_at) VALUES
  ('test-host-001', 'testhost@enjoyhub.pl', 'Jan Testowy', true, true, NOW())
ON CONFLICT (id) DO NOTHING;

-- Get category IDs (we'll use the slugs to reference them)
-- paintball, gokarty, trampoliny, place-zabaw, restauracje-dzieci, ekstremalne

-- PAINTBALL PROPERTIES (8 properties)
INSERT INTO properties (host_id, title, description, property_type, address, city, country, latitude, longitude, price_per_night, max_guests, bedrooms, bathrooms, is_active, category_id, created_at) 
SELECT 
  'test-host-001',
  'Paintball Arena "Thunder"',
  'Profesjonalna arena paintballowa w centrum Warszawy. Idealna dla grup firmowych i imprez integracyjnych.',
  'venue',
  'ul. Marszałkowska 10',
  'Warszawa',
  'Polska',
  52.229676,
  21.012229,
  150.00,
  20,
  1,
  2,
  true,
  id,
  NOW()
FROM categories WHERE slug = 'paintball';

INSERT INTO properties (host_id, title, description, property_type, address, city, country, latitude, longitude, price_per_night, max_guests, bedrooms, bathrooms, is_active, category_id, created_at)
SELECT 
  'test-host-001',
  'Outdoor Paintball Kraków',
  'Paintball na świeżym powietrzu z naturalnymi przeszkodami i fortyfikacjami.',
  'venue',
  'ul. Wielicka 260',
  'Kraków',
  'Polska',
  50.047128,
  19.985594,
  120.00,
  16,
  1,
  1,
  true,
  id,
  NOW()
FROM categories WHERE slug = 'paintball';

INSERT INTO properties (host_id, title, description, property_type, address, city, country, latitude, longitude, price_per_night, max_guests, bedrooms, bathrooms, is_active, category_id, created_at)
SELECT 
  'test-host-001',
  'Paintball Park Wrocław',
  'Duża arena z kilkoma strefami gry. Organizujemy turnieje i eventy korporacyjne.',
  'venue',
  'ul. Graniczna 2',
  'Wrocław',
  'Polska',
  51.107883,
  17.038538,
  130.00,
  18,
  1,
  2,
  true,
  id,
  NOW()
FROM categories WHERE slug = 'paintball';

INSERT INTO properties (host_id, title, description, property_type, address, city, country, latitude, longitude, price_per_night, max_guests, bedrooms, bathrooms, is_active, category_id, created_at)
SELECT 
  'test-host-001',
  'Laser Tag & Paintball Poznań',
  'Połączenie laser tagu i paintballu. Idealne dla rodzin z dziećmi.',
  'venue',
  'ul. Bukowska 15',
  'Poznań',
  'Polska',
  52.406374,
  16.925167,
  140.00,
  15,
  1,
  1,
  true,
  id,
  NOW()
FROM categories WHERE slug = 'paintball';

INSERT INTO properties (host_id, title, description, property_type, address, city, country, latitude, longitude, price_per_night, max_guests, bedrooms, bathrooms, is_active, category_id, created_at)
SELECT 
  'test-host-001',
  'Paintball Trójmiasto',
  'Arena paintballowa blisko plaży. Możliwość organizacji wieczorów kawalerskich.',
  'venue',
  'ul. Grunwaldzka 82',
  'Gdańsk',
  'Polska',
  54.372158,
  18.638306,
  160.00,
  20,
  1,
  2,
  true,
  id,
  NOW()
FROM categories WHERE slug = 'paintball';

INSERT INTO properties (host_id, title, description, property_type, address, city, country, latitude, longitude, price_per_night, max_guests, bedrooms, bathrooms, is_active, category_id, created_at)
SELECT 
  'test-host-001',
  'Paintball Łódź Center',
  'Paintball w centrum Łodzi z klimatyzowaną strefą odpoczynku.',
  'venue',
  'ul. Piotrkowska 100',
  'Łódź',
  'Polska',
  51.759248,
  19.455983,
  110.00,
  14,
  1,
  1,
  true,
  id,
  NOW()
FROM categories WHERE slug = 'paintball';

INSERT INTO properties (host_id, title, description, property_type, address, city, country, latitude, longitude, price_per_night, max_guests, bedrooms, bathrooms, is_active, category_id, created_at)
SELECT 
  'test-host-001',
  'Paintball Katowice "Silesia"',
  'Największa arena paintballowa na Śląsku. 3 różne strefy gry.',
  'venue',
  'ul. Korfantego 2',
  'Katowice',
  'Polska',
  50.264892,
  19.023781,
  135.00,
  22,
  1,
  2,
  true,
  id,
  NOW()
FROM categories WHERE slug = 'paintball';

INSERT INTO properties (host_id, title, description, property_type, address, city, country, latitude, longitude, price_per_night, max_guests, bedrooms, bathrooms, is_active, category_id, created_at)
SELECT 
  'test-host-001',
  'Paintball Lublin Adventure',
  'Paintball z elementami gier terenowych. Świetna zabawa dla całej rodziny.',
  'venue',
  'ul. Lipowa 13',
  'Lublin',
  'Polska',
  51.246454,
  22.568446,
  100.00,
  12,
  1,
  1,
  true,
  id,
  NOW()
FROM categories WHERE slug = 'paintball';

-- GOKARTY PROPERTIES (7 properties)
INSERT INTO properties (host_id, title, description, property_type, address, city, country, latitude, longitude, price_per_night, max_guests, bedrooms, bathrooms, is_active, category_id, created_at)
SELECT 
  'test-host-001',
  'Tor Gokartowy "Speed King" Warszawa',
  'Profesjonalny tor indoor z gokartami elektrycznymi. Timing elektroniczny.',
  'venue',
  'ul. Wał Miedzeszyński 389',
  'Warszawa',
  'Polska',
  52.248013,
  21.153763,
  200.00,
  10,
  1,
  2,
  true,
  id,
  NOW()
FROM categories WHERE slug = 'gokarty';

INSERT INTO properties (host_id, title, description, property_type, address, city, country, latitude, longitude, price_per_night, max_guests, bedrooms, bathrooms, is_active, category_id, created_at)
SELECT 
  'test-host-001',
  'Gokarty Outdoor Kraków',
  'Tor zewnętrzny długości 850m. Gokarty spalinowe i elektryczne.',
  'venue',
  'ul. Zakopiańska 62',
  'Kraków',
  'Polska',
  50.015850,
  19.923671,
  180.00,
  12,
  1,
  1,
  true,
  id,
  NOW()
FROM categories WHERE slug = 'gokarty';

INSERT INTO properties (host_id, title, description, property_type, address, city, country, latitude, longitude, price_per_night, max_guests, bedrooms, bathrooms, is_active, category_id, created_at)
SELECT 
  'test-host-001',
  'Kart Racing Wrocław',
  'Tor kartingowy z systemem rezerwacji online. Organizujemy wyścigi firmowe.',
  'venue',
  'ul. Opolska 100',
  'Wrocław',
  'Polska',
  51.084410,
  17.010950,
  190.00,
  8,
  1,
  2,
  true,
  id,
  NOW()
FROM categories WHERE slug = 'gokarty';

INSERT INTO properties (host_id, title, description, property_type, address, city, country, latitude, longitude, price_per_night, max_guests, bedrooms, bathrooms, is_active, category_id, created_at)
SELECT 
  'test-host-001',
  'Gokarty dla Dzieci - Poznań',
  'Specjalny tor dla najmłodszych. Gokarty z ograniczeniem prędkości.',
  'venue',
  'ul. Szamarzewskiego 27',
  'Poznań',
  'Polska',
  52.394790,
  16.889648,
  120.00,
  8,
  1,
  1,
  true,
  id,
  NOW()
FROM categories WHERE slug = 'gokarty';

INSERT INTO properties (host_id, title, description, property_type, address, city, country, latitude, longitude, price_per_night, max_guests, bedrooms, bathrooms, is_active, category_id, created_at)
SELECT 
  'test-host-001',
  'Karting Arena Gdynia',
  'Nowoczesna hala kartingowa. Tor o długości 600m z 12 zakrętami.',
  'venue',
  'ul. Chwaszczyńska 131',
  'Gdynia',
  'Polska',
  54.503774,
  18.534393,
  210.00,
  10,
  1,
  2,
  true,
  id,
  NOW()
FROM categories WHERE slug = 'gokarty';

INSERT INTO properties (host_id, title, description, property_type, address, city, country, latitude, longitude, price_per_night, max_guests, bedrooms, bathrooms, is_active, category_id, created_at)
SELECT 
  'test-host-001',
  'Fast Track Katowice',
  'Tor gokartowy z najnowocześniejszymi gokartami elektrycznymi.',
  'venue',
  'ul. Brynowska 72',
  'Katowice',
  'Polska',
  50.293446,
  19.020517,
  195.00,
  9,
  1,
  1,
  true,
  id,
  NOW()
FROM categories WHERE slug = 'gokarty';

INSERT INTO properties (host_id, title, description, property_type, address, city, country, latitude, longitude, price_per_night, max_guests, bedrooms, bathrooms, is_active, category_id, created_at)
SELECT 
  'test-host-001',
  'Tor Kartingowy Bydgoszcz',
  'Tor kartingowy z profesjonalnym timingiem i wypożyczalnią sprzętu.',
  'venue',
  'ul. Fordońska 246',
  'Bydgoszcz',
  'Polska',
  53.133970,
  18.022920,
  170.00,
  10,
  1,
  1,
  true,
  id,
  NOW()
FROM categories WHERE slug = 'gokarty';

-- TRAMPOLINY PROPERTIES (7 properties)
INSERT INTO properties (host_id, title, description, property_type, address, city, country, latitude, longitude, price_per_night, max_guests, bedrooms, bathrooms, is_active, category_id, created_at)
SELECT 
  'test-host-001',
  'Jump Arena Warszawa',
  'Największy park trampolin w Warszawie. Ponad 100 trampolin połączonych.',
  'venue',
  'ul. Targówek 50',
  'Warszawa',
  'Polska',
  52.294479,
  21.051941,
  160.00,
  30,
  1,
  3,
  true,
  id,
  NOW()
FROM categories WHERE slug = 'trampoliny';

INSERT INTO properties (host_id, title, description, property_type, address, city, country, latitude, longitude, price_per_night, max_guests, bedrooms, bathrooms, is_active, category_id, created_at)
SELECT 
  'test-host-001',
  'Sky Jump Kraków',
  'Park trampolin z basenem z pianki i ścianą wspinaczkową.',
  'venue',
  'ul. Kapelanka 54',
  'Kraków',
  'Polska',
  50.034134,
  19.955149,
  150.00,
  25,
  1,
  2,
  true,
  id,
  NOW()
FROM categories WHERE slug = 'trampoliny';

INSERT INTO properties (host_id, title, description, property_type, address, city, country, latitude, longitude, price_per_night, max_guests, bedrooms, bathrooms, is_active, category_id, created_at)
SELECT 
  'test-host-001',
  'Trampoliny "Wyskok" Wrocław',
  'Trampoliny dla dzieci i dorosłych. Instruktorzy akrobatyki na miejscu.',
  'venue',
  'ul. Dyrekcyjna 9',
  'Wrocław',
  'Polska',
  51.135344,
  16.982593,
  140.00,
  20,
  1,
  2,
  true,
  id,
  NOW()
FROM categories WHERE slug = 'trampoliny';

INSERT INTO properties (host_id, title, description, property_type, address, city, country, latitude, longitude, price_per_night, max_guests, bedrooms, bathrooms, is_active, category_id, created_at)
SELECT 
  'test-host-001',
  'Fly High Poznań',
  'Park trampolin z dedykowaną strefą dla maluchów. Urodziny i eventy.',
  'venue',
  'ul. Roosevelta 18',
  'Poznań',
  'Polska',
  52.423611,
  16.945000,
  145.00,
  22,
  1,
  2,
  true,
  id,
  NOW()
FROM categories WHERE slug = 'trampoliny';

INSERT INTO properties (host_id, title, description, property_type, address, city, country, latitude, longitude, price_per_night, max_guests, bedrooms, bathrooms, is_active, category_id, created_at)
SELECT 
  'test-host-001',
  'Gravity Park Gdańsk',
  'Trampoliny olimpijskie i freestyle. Zajęcia grupowe i indywidualne.',
  'venue',
  'ul. Marynarki Polskiej 55',
  'Gdańsk',
  'Polska',
  54.358887,
  18.646069,
  155.00,
  18,
  1,
  2,
  true,
  id,
  NOW()
FROM categories WHERE slug = 'trampoliny';

INSERT INTO properties (host_id, title, description, property_type, address, city, country, latitude, longitude, price_per_night, max_guests, bedrooms, bathrooms, is_active, category_id, created_at)
SELECT 
  'test-host-001',
  'Bounce Łódź',
  'Park trampolin z dodatkową strefą ninja warrior.',
  'venue',
  'ul. Łąkowa 2',
  'Łódź',
  'Polska',
  51.773334,
  19.472778,
  130.00,
  24,
  1,
  2,
  true,
  id,
  NOW()
FROM categories WHERE slug = 'trampoliny';

INSERT INTO properties (host_id, title, description, property_type, address, city, country, latitude, longitude, price_per_night, max_guests, bedrooms, bathrooms, is_active, category_id, created_at)
SELECT 
  'test-host-001',
  'Trampoline World Szczecin',
  'Nowoczesny park trampolin z kawiarenką dla rodziców.',
  'venue',
  'ul. Struga 62',
  'Szczecin',
  'Polska',
  53.432891,
  14.548556,
  135.00,
  20,
  1,
  2,
  true,
  id,
  NOW()
FROM categories WHERE slug = 'trampoliny';

-- PLACE ZABAW PROPERTIES (6 properties)
INSERT INTO properties (host_id, title, description, property_type, address, city, country, latitude, longitude, price_per_night, max_guests, bedrooms, bathrooms, is_active, category_id, created_at)
SELECT 
  'test-host-001',
  'Plac Zabaw "Bajkolandia" Warszawa',
  'Kolorowy plac zabaw z bezpiecznymi urządzeniami. Organizujemy urodziny.',
  'venue',
  'ul. Bellottiego 1',
  'Warszawa',
  'Polska',
  52.163574,
  21.089462,
  100.00,
  40,
  1,
  2,
  true,
  id,
  NOW()
FROM categories WHERE slug = 'place-zabaw';

INSERT INTO properties (host_id, title, description, property_type, address, city, country, latitude, longitude, price_per_night, max_guests, bedrooms, bathrooms, is_active, category_id, created_at)
SELECT 
  'test-host-001',
  'Sala Zabaw "Wesołe Miasteczko" Kraków',
  'Duża sala zabaw z basenem z kulkami i trampolinami.',
  'venue',
  'ul. Zacisze 7',
  'Kraków',
  'Polska',
  50.082729,
  20.032511,
  90.00,
  35,
  1,
  2,
  true,
  id,
  NOW()
FROM categories WHERE slug = 'place-zabaw';

INSERT INTO properties (host_id, title, description, property_type, address, city, country, latitude, longitude, price_per_night, max_guests, bedrooms, bathrooms, is_active, category_id, created_at)
SELECT 
  'test-host-001',
  'Kids Park Wrocław',
  'Nowoczesny plac zabaw z klimatyzacją. Animatorzy na miejscu.',
  'venue',
  'ul. Powstańców Śląskich 95',
  'Wrocław',
  'Polska',
  51.116667,
  17.033333,
  85.00,
  30,
  1,
  2,
  true,
  id,
  NOW()
FROM categories WHERE slug = 'place-zabaw';

INSERT INTO properties (host_id, title, description, property_type, address, city, country, latitude, longitude, price_per_night, max_guests, bedrooms, bathrooms, is_active, category_id, created_at)
SELECT 
  'test-host-001',
  'Plac Zabaw "Tęcza" Poznań',
  'Plac zabaw z kilkoma strefami wiekowymi. Menu dla dzieci.',
  'venue',
  'ul. 28 Czerwca 1956 nr 223',
  'Poznań',
  'Polska',
  52.395834,
  16.920278,
  95.00,
  32,
  1,
  2,
  true,
  id,
  NOW()
FROM categories WHERE slug = 'place-zabaw';

INSERT INTO properties (host_id, title, description, property_type, address, city, country, latitude, longitude, price_per_night, max_guests, bedrooms, bathrooms, is_active, category_id, created_at)
SELECT 
  'test-host-001',
  'Fun Park Gdańsk',
  'Sala zabaw z torem przeszkód i zjeżdżalniami.',
  'venue',
  'ul. Grunwaldzka 141',
  'Gdańsk',
  'Polska',
  54.395570,
  18.594278,
  88.00,
  28,
  1,
  1,
  true,
  id,
  NOW()
FROM categories WHERE slug = 'place-zabaw';

INSERT INTO properties (host_id, title, description, property_type, address, city, country, latitude, longitude, price_per_night, max_guests, bedrooms, bathrooms, is_active, category_id, created_at)
SELECT 
  'test-host-001',
  'Zabawkowo Katowice',
  'Kreatywna sala zabaw z warsztatami dla dzieci.',
  'venue',
  'ul. 3 Maja 26',
  'Katowice',
  'Polska',
  50.257778,
  19.026667,
  92.00,
  25,
  1,
  2,
  true,
  id,
  NOW()
FROM categories WHERE slug = 'place-zabaw';

-- RESTAURACJE DLA DZIECI PROPERTIES (6 properties)
INSERT INTO properties (host_id, title, description, property_type, address, city, country, latitude, longitude, price_per_night, max_guests, bedrooms, bathrooms, is_active, category_id, created_at)
SELECT 
  'test-host-001',
  'Restauracja "Smakosz" Warszawa',
  'Restauracja rodzinna z kącikiem zabaw. Menu dla dzieci i dorosłych.',
  'restaurant',
  'ul. Puławska 2',
  'Warszawa',
  'Polska',
  52.180000,
  21.022778,
  80.00,
  60,
  1,
  3,
  true,
  id,
  NOW()
FROM categories WHERE slug = 'restauracje-dzieci';

INSERT INTO properties (host_id, title, description, property_type, address, city, country, latitude, longitude, price_per_night, max_guests, bedrooms, bathrooms, is_active, category_id, created_at)
SELECT 
  'test-host-001',
  'Pizza Kids Kraków',
  'Pizzeria z salą zabaw i animatorami w weekendy.',
  'restaurant',
  'ul. Kalwaryjska 56',
  'Kraków',
  'Polska',
  50.051389,
  19.945278,
  70.00,
  50,
  1,
  2,
  true,
  id,
  NOW()
FROM categories WHERE slug = 'restauracje-dzieci';

INSERT INTO properties (host_id, title, description, property_type, address, city, country, latitude, longitude, price_per_night, max_guests, bedrooms, bathrooms, is_active, category_id, created_at)
SELECT 
  'test-host-001',
  'Family Burger Wrocław',
  'Burgery i zabawy dla całej rodziny. Organizujemy urodziny.',
  'restaurant',
  'ul. Świdnicka 40',
  'Wrocław',
  'Polska',
  51.108889,
  17.038333,
  75.00,
  55,
  1,
  2,
  true,
  id,
  NOW()
FROM categories WHERE slug = 'restauracje-dzieci';

INSERT INTO properties (host_id, title, description, property_type, address, city, country, latitude, longitude, price_per_night, max_guests, bedrooms, bathrooms, is_active, category_id, created_at)
SELECT 
  'test-host-001',
  'Bajkowa Karczma Poznań',
  'Restauracja w stylu bajkowym. Interaktywne show dla dzieci.',
  'restaurant',
  'ul. Półwiejska 42',
  'Poznań',
  'Polska',
  52.406944,
  16.924722,
  85.00,
  45,
  1,
  2,
  true,
  id,
  NOW()
FROM categories WHERE slug = 'restauracje-dzieci';

INSERT INTO properties (host_id, title, description, property_type, address, city, country, latitude, longitude, price_per_night, max_guests, bedrooms, bathrooms, is_active, category_id, created_at)
SELECT 
  'test-host-001',
  'Mała Włochy Gdańsk',
  'Włoska restauracja z kącikiem zabaw i warsztatami gotowania.',
  'restaurant',
  'ul. Długa 1',
  'Gdańsk',
  'Polska',
  54.348889,
  18.653333,
  78.00,
  48,
  1,
  2,
  true,
  id,
  NOW()
FROM categories WHERE slug = 'restauracje-dzieci';

INSERT INTO properties (host_id, title, description, property_type, address, city, country, latitude, longitude, price_per_night, max_guests, bedrooms, bathrooms, is_active, category_id, created_at)
SELECT 
  'test-host-001',
  'Słodka Chatka Łódź',
  'Restauracja deserowa z placem zabaw. Wypieki własne.',
  'restaurant',
  'ul. Gdańska 72',
  'Łódź',
  'Polska',
  51.764167,
  19.459444,
  65.00,
  40,
  1,
  2,
  true,
  id,
  NOW()
FROM categories WHERE slug = 'restauracje-dzieci';

-- EKSTREMALNE PROPERTIES (6 properties)
INSERT INTO properties (host_id, title, description, property_type, address, city, country, latitude, longitude, price_per_night, max_guests, bedrooms, bathrooms, is_active, category_id, created_at)
SELECT 
  'test-host-001',
  'Park Linowy "Adrenalina" Warszawa',
  'Wysokościowy park linowy z 5 trasami o różnej trudności.',
  'venue',
  'ul. Malownicza 1',
  'Warszawa',
  'Polska',
  52.241389,
  20.995556,
  180.00,
  15,
  1,
  1,
  true,
  id,
  NOW()
FROM categories WHERE slug = 'ekstremalne';

INSERT INTO properties (host_id, title, description, property_type, address, city, country, latitude, longitude, price_per_night, max_guests, bedrooms, bathrooms, is_active, category_id, created_at)
SELECT 
  'test-host-001',
  'Ścianka Wspinaczkowa "Vertical" Kraków',
  'Profesjonalna ścianka wspinaczkowa indoor. Kursy dla początkujących.',
  'venue',
  'ul. Bulwarowa 1',
  'Kraków',
  'Polska',
  50.069444,
  19.981111,
  120.00,
  12,
  1,
  2,
  true,
  id,
  NOW()
FROM categories WHERE slug = 'ekstremalne';

INSERT INTO properties (host_id, title, description, property_type, address, city, country, latitude, longitude, price_per_night, max_guests, bedrooms, bathrooms, is_active, category_id, created_at)
SELECT 
  'test-host-001',
  'Bungee Jumping Zakopane',
  'Skoki na bungee z mostu. Niesamowite widoki na Tatry.',
  'venue',
  'ul. Kościuszki 10',
  'Zakopane',
  'Polska',
  49.299167,
  19.949444,
  250.00,
  1,
  1,
  1,
  true,
  id,
  NOW()
FROM categories WHERE slug = 'ekstremalne';

INSERT INTO properties (host_id, title, description, property_type, address, city, country, latitude, longitude, price_per_night, max_guests, bedrooms, bathrooms, is_active, category_id, created_at)
SELECT 
  'test-host-001',
  'Quadlandia Poznań',
  'Jazdy quadami po torze offroad. Wypożyczalnia sprzętu.',
  'venue',
  'ul. Krzesińska 2',
  'Poznań',
  'Polska',
  52.420000,
  16.899444,
  200.00,
  8,
  1,
  1,
  true,
  id,
  NOW()
FROM categories WHERE slug = 'ekstremalne';

INSERT INTO properties (host_id, title, description, property_type, address, city, country, latitude, longitude, price_per_night, max_guests, bedrooms, bathrooms, is_active, category_id, created_at)
SELECT 
  'test-host-001',
  'Skydive Gliwice',
  'Symulator spadochronowy - skoki w tunelu aerodynamicznym.',
  'venue',
  'ul. Portowa 28',
  'Gliwice',
  'Polska',
  50.294444,
  18.678889,
  220.00,
  6,
  1,
  1,
  true,
  id,
  NOW()
FROM categories WHERE slug = 'ekstremalne';

INSERT INTO properties (host_id, title, description, property_type, address, city, country, latitude, longitude, price_per_night, max_guests, bedrooms, bathrooms, is_active, category_id, created_at)
SELECT 
  'test-host-001',
  'Rafting Dunajec',
  'Spływy pontonowe po Dunajcu. Przepiękne widoki na Pieniny.',
  'venue',
  'ul. Jagiellońska 10',
  'Szczawnica',
  'Polska',
  49.416667,
  20.500000,
  150.00,
  10,
  1,
  1,
  true,
  id,
  NOW()
FROM categories WHERE slug = 'ekstremalne';

-- Add some reviews to make properties more realistic
INSERT INTO reviews (property_id, guest_id, rating, comment, created_at)
SELECT 
  p.id,
  'test-host-001',
  FLOOR(RANDOM() * 2 + 4)::INTEGER, -- Random rating between 4-5
  'Świetne miejsce! Polecam wszystkim.',
  NOW() - (RANDOM() * INTERVAL '30 days')
FROM properties p
WHERE p.host_id = 'test-host-001'
LIMIT 20;

-- Add more varied reviews
INSERT INTO reviews (property_id, guest_id, rating, comment, created_at)
SELECT 
  p.id,
  'test-host-001',
  FLOOR(RANDOM() * 3 + 3)::INTEGER, -- Random rating between 3-5
  'Bardzo dobra obsługa i świetna zabawa!',
  NOW() - (RANDOM() * INTERVAL '60 days')
FROM properties p
WHERE p.host_id = 'test-host-001'
OFFSET 20
LIMIT 15;

COMMIT;
