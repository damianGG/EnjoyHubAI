-- Add sample offers for playrooms to demonstrate single-day time-slot booking
-- This script creates offers for playroom properties to enable time-slot based bookings

-- First, let's identify playroom properties (category: 'place-zabaw')
-- We'll create offers for these properties

DO $$
DECLARE
  playroom_category_id UUID;
  sample_property_id UUID;
BEGIN
  -- Get the playroom category ID
  SELECT id INTO playroom_category_id 
  FROM categories 
  WHERE slug = 'place-zabaw' 
  LIMIT 1;

  -- If category exists, create offers for playroom properties
  IF playroom_category_id IS NOT NULL THEN
    -- Get a sample playroom property
    SELECT id INTO sample_property_id 
    FROM properties 
    WHERE category_id = playroom_category_id 
      AND is_active = true 
    LIMIT 1;

    -- If we found a playroom property, create sample offers
    IF sample_property_id IS NOT NULL THEN
      -- Offer 1: Standard Playroom Session (2 hours)
      INSERT INTO offers (place_id, title, description, base_price, currency, duration_minutes, min_participants, max_participants, is_active)
      VALUES (
        sample_property_id,
        'Sesja w sali zabaw - 2 godziny',
        'Dwugodzinna zabawa w naszej sali zabaw. Idealna opcja dla dzieci w wieku 3-10 lat. Sala wyposażona w bezpieczne atrakcje, basen z kulkami, zjeżdżalnie i trampoliny.',
        25.00,
        'PLN',
        120, -- 2 hours
        1,
        15,
        true
      )
      ON CONFLICT DO NOTHING;

      -- Offer 2: Extended Playroom Session (3 hours)
      INSERT INTO offers (place_id, title, description, base_price, currency, duration_minutes, min_participants, max_participants, is_active)
      VALUES (
        sample_property_id,
        'Sesja w sali zabaw - 3 godziny',
        'Trzygodzinna zabawa dla aktywnych dzieci. Pełen dostęp do wszystkich atrakcji w sali zabaw.',
        30.00,
        'PLN',
        180, -- 3 hours
        1,
        15,
        true
      )
      ON CONFLICT DO NOTHING;

      -- Offer 3: Birthday Party Package
      INSERT INTO offers (place_id, title, description, base_price, currency, duration_minutes, min_participants, max_participants, is_active)
      VALUES (
        sample_property_id,
        'Pakiet urodzinowy',
        'Ekskluzywna rezerwacja sali zabaw na urodziny dziecka. Pakiet obejmuje 3 godziny zabawy, dekoracje i opiekę animatorów.',
        50.00,
        'PLN',
        180, -- 3 hours
        5,
        20,
        true
      )
      ON CONFLICT DO NOTHING;

      -- Now create availability slots for these offers
      -- We'll create availability for all offers at this property
      
      -- Weekday availability (Monday-Friday, 0-4)
      INSERT INTO offer_availability (offer_id, weekday, start_time, end_time, slot_length_minutes, max_bookings_per_slot)
      SELECT 
        o.id,
        wd.weekday,
        '10:00'::time,
        '20:00'::time,
        o.duration_minutes,
        1 -- Only one booking per slot (exclusive sessions)
      FROM offers o
      CROSS JOIN (
        SELECT 0 AS weekday UNION ALL -- Monday
        SELECT 1 UNION ALL -- Tuesday
        SELECT 2 UNION ALL -- Wednesday
        SELECT 3 UNION ALL -- Thursday
        SELECT 4 -- Friday
      ) wd
      WHERE o.place_id = sample_property_id
        AND o.title != 'Pakiet urodzinowy' -- Birthday package has different availability
      ON CONFLICT DO NOTHING;

      -- Weekend availability (Saturday-Sunday, 5-6) - longer hours
      INSERT INTO offer_availability (offer_id, weekday, start_time, end_time, slot_length_minutes, max_bookings_per_slot)
      SELECT 
        o.id,
        wd.weekday,
        '09:00'::time,
        '21:00'::time,
        o.duration_minutes,
        1
      FROM offers o
      CROSS JOIN (
        SELECT 5 AS weekday UNION ALL -- Saturday
        SELECT 6 -- Sunday
      ) wd
      WHERE o.place_id = sample_property_id
        AND o.title != 'Pakiet urodzinowy'
      ON CONFLICT DO NOTHING;

      -- Birthday package - available on weekends only
      INSERT INTO offer_availability (offer_id, weekday, start_time, end_time, slot_length_minutes, max_bookings_per_slot)
      SELECT 
        o.id,
        wd.weekday,
        '11:00'::time,
        '18:00'::time,
        o.duration_minutes,
        1 -- Exclusive booking
      FROM offers o
      CROSS JOIN (
        SELECT 5 AS weekday UNION ALL -- Saturday
        SELECT 6 -- Sunday
      ) wd
      WHERE o.place_id = sample_property_id
        AND o.title = 'Pakiet urodzinowy'
      ON CONFLICT DO NOTHING;

      RAISE NOTICE 'Sample offers and availability created successfully for property %', sample_property_id;
    ELSE
      RAISE NOTICE 'No playroom properties found. Please add properties with category "place-zabaw" first.';
    END IF;
  ELSE
    RAISE NOTICE 'Playroom category not found. Please run category creation scripts first.';
  END IF;
END $$;

-- Display summary
DO $$ 
BEGIN
  RAISE NOTICE 'Total offers: %', (SELECT COUNT(*) FROM offers);
  RAISE NOTICE 'Total offer availability slots: %', (SELECT COUNT(*) FROM offer_availability);
  RAISE NOTICE 'Sample offers created for playrooms. Attractions with offers will now use single-day time-slot booking!';
END $$;
