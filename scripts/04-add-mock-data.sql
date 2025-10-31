-- Mock data for testing categories and properties
-- First, let's add some mock users (hosts)
INSERT INTO users (id, email, full_name, user_type, created_at) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'host1@example.com', 'Anna Kowalska', 'host', NOW()),
  ('550e8400-e29b-41d4-a716-446655440002', 'host2@example.com', 'Piotr Nowak', 'host', NOW()),
  ('550e8400-e29b-41d4-a716-446655440003', 'host3@example.com', 'Maria Wiśniewska', 'host', NOW()),
  ('550e8400-e29b-41d4-a716-446655440004', 'host4@example.com', 'Tomasz Wójcik', 'host', NOW()),
  ('550e8400-e29b-41d4-a716-446655440005', 'host5@example.com', 'Katarzyna Kamińska', 'host', NOW()),
  ('550e8400-e29b-41d4-a716-446655440006', 'host6@example.com', 'Michał Lewandowski', 'host', NOW())
ON CONFLICT (id) DO NOTHING;

-- Mock properties for each category
-- PLACE ZABAW
INSERT INTO properties (id, host_id, title, description, category_id, price_per_hour, location, latitude, longitude, max_guests, amenities, images, created_at) VALUES
  ('prop-playground-001', '550e8400-e29b-41d4-a716-446655440001', 'Kolorowy Plac Zabaw "Tęcza"', 'Nowoczesny plac zabaw z bezpiecznymi urządzeniami dla dzieci w wieku 3-12 lat. Zjeżdżalnie, huśtawki, drabinki wspinaczkowe i piaskownica.', 1, 25.00, 'Warszawa, Mokotów', 52.1672, 21.0128, 20, '["parking", "toalety", "kawiarnia", "ogrodzenie"]', '["/placeholder.svg?height=300&width=400", "/placeholder.svg?height=300&width=400", "/placeholder.svg?height=300&width=400"]', NOW()),
  
  ('prop-playground-002', '550e8400-e29b-41d4-a716-446655440002', 'Plac Zabaw "Przygoda"', 'Duży plac zabaw z tematycznymi strefami: zamek, statek piracki i wioska indiańska. Idealne miejsce na urodziny dziecka.', 1, 30.00, 'Kraków, Podgórze', 50.0647, 19.9450, 25, '["parking", "toalety", "grill", "altanka"]', '["/placeholder.svg?height=300&width=400", "/placeholder.svg?height=300&width=400", "/placeholder.svg?height=300&width=400"]', NOW()),

-- TRAMPOLINY  
  ('prop-trampoline-001', '550e8400-e29b-41d4-a716-446655440002', 'Trampoliny Park "Skok"', 'Profesjonalne trampoliny olimpijskie w hali. Strefa dla dzieci, strefa freestyle i strefa do gier zespołowych.', 2, 40.00, 'Gdańsk, Wrzeszcz', 54.3520, 18.6466, 15, '["szatnie", "prysznice", "kawiarnia", "parking"]', '["/placeholder.svg?height=300&width=400", "/placeholder.svg?height=300&width=400", "/placeholder.svg?height=300&width=400"]', NOW()),
  
  ('prop-trampoline-002', '550e8400-e29b-41d4-a716-446655440003', 'Outdoor Trampoliny "Niebo"', 'Trampoliny na świeżym powietrzu z widokiem na las. Różne rozmiary trampolines dla wszystkich grup wiekowych.', 2, 35.00, 'Zakopane, centrum', 49.2992, 19.9496, 12, '["parking", "toalety", "widok_na_góry", "bezpieczeństwo"]', '["/placeholder.svg?height=300&width=400", "/placeholder.svg?height=300&width=400", "/placeholder.svg?height=300&width=400"]', NOW()),

-- GOKARTY
  ('prop-gokart-001', '550e8400-e29b-41d4-a716-446655440003', 'Tor Gokartowy "Szybcy i Wściekli"', 'Profesjonalny tor gokartowy długości 800m z zakrętami i prostymi. Gokarty elektryczne i spalinowe.', 3, 60.00, 'Wrocław, Fabryczna', 51.1079, 17.0385, 8, '["kaski", "kombinezony", "timing", "kawiarnia"]', '["/placeholder.svg?height=300&width=400", "/placeholder.svg?height=300&width=400", "/placeholder.svg?height=300&width=400"]', NOW()),
  
  ('prop-gokart-002', '550e8400-e29b-41d4-a716-446655440004', 'Mini Gokarty dla Dzieci', 'Bezpieczny tor dla najmłodszych kierowców. Gokarty elektryczne z ograniczeniem prędkości dla dzieci 6-14 lat.', 3, 35.00, 'Poznań, Stare Miasto', 52.4064, 16.9252, 10, '["kaski_dziecięce", "instruktor", "parking", "toalety"]', '["/placeholder.svg?height=300&width=400", "/placeholder.svg?height=300&width=400", "/placeholder.svg?height=300&width=400"]', NOW()),

-- PAINTBALL
  ('prop-paintball-001', '550e8400-e29b-41d4-a716-446655440004', 'Paintball Arena "Wojna"', 'Duża arena paintballowa z naturalnymi i sztucznymi przeszkodami. Różne scenariusze gier i profesjonalny sprzęt.', 4, 45.00, 'Łódź, Bałuty', 51.7592, 19.4560, 20, '["markery", "maski", "kombinezony", "kulki"]', '["/placeholder.svg?height=300&width=400", "/placeholder.svg?height=300&width=400", "/placeholder.svg?height=300&width=400"]', NOW()),
  
  ('prop-paintball-002', '550e8400-e29b-41d4-a716-446655440005', 'Paintball Las "Commando"', 'Paintball w naturalnym lesie z fortyfikacjami. Gry scenariuszowe i turnieje dla zaawansowanych.', 4, 50.00, 'Katowice, Murcki', 50.2649, 19.0238, 16, '["markery_profesjonalne", "maski", "amunicja", "instruktor"]', '["/placeholder.svg?height=300&width=400", "/placeholder.svg?height=300&width=400", "/placeholder.svg?height=300&width=400"]', NOW()),

-- RESTAURACJE DLA DZIECI
  ('prop-restaurant-001', '550e8400-e29b-41d4-a716-446655440005', 'Restauracja "Bajkowy Świat"', 'Rodzinna restauracja z kącikiem zabaw, animatorami i menu dla dzieci. Organizujemy urodziny i imprezy.', 5, 20.00, 'Warszawa, Wilanów', 52.1635, 21.0895, 50, '["kącik_zabaw", "animatorzy", "menu_dziecięce", "parking"]', '["/placeholder.svg?height=300&width=400", "/placeholder.svg?height=300&width=400", "/placeholder.svg?height=300&width=400"]', NOW()),
  
  ('prop-restaurant-002', '550e8400-e29b-41d4-a716-446655440006', 'Pizza & Play "Mamma Mia"', 'Pizzeria z salą zabaw, automatami i strefą VR dla dzieci. Świeża pizza i włoskie lody.', 5, 25.00, 'Gdynia, Śródmieście', 54.5189, 18.5305, 40, '["sala_zabaw", "automaty", "VR", "pizza_na_miejscu"]', '["/placeholder.svg?height=300&width=400", "/placeholder.svg?height=300&width=400", "/placeholder.svg?height=300&width=400"]', NOW()),

-- EKSTREMALNE
  ('prop-extreme-001', '550e8400-e29b-41d4-a716-446655440006', 'Park Linowy "Adrenalina"', 'Wysokościowy park linowy z trasami o różnym stopniu trudności. Tyrolka 200m i ściana wspinaczkowa.', 6, 55.00, 'Białka Tatrzańska', 49.4167, 20.1167, 12, '["uprzęże", "kaski", "instruktor", "tyrolka"]', '["/placeholder.svg?height=300&width=400", "/placeholder.svg?height=300&width=400", "/placeholder.svg?height=300&width=400"]', NOW()),
  
  ('prop-extreme-002', '550e8400-e29b-41d4-a716-446655440001', 'Skoki na Bungee "Gravity"', 'Profesjonalne skoki na bungee z mostu wysokości 50m. Bezpieczeństwo gwarantowane przez certyfikowanych instruktorów.', 6, 80.00, 'Sosnowiec, Zagórze', 50.2862, 19.1040, 1, '["sprzęt_certyfikowany", "instruktor", "ubezpieczenie", "film"]', '["/placeholder.svg?height=300&width=400", "/placeholder.svg?height=300&width=400", "/placeholder.svg?height=300&width=400"]', NOW());
