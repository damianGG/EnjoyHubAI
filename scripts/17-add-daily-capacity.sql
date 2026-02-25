-- Add daily capacity support for multi-booking feature
-- This allows venues like Play Centers to sell multiple tickets per day

-- Add daily capacity fields to attraction_availability table
DO $$ 
BEGIN
  -- Add enable_multi_booking flag
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='attraction_availability' AND column_name='enable_multi_booking') THEN
    ALTER TABLE attraction_availability ADD COLUMN enable_multi_booking BOOLEAN DEFAULT false;
  END IF;
  
  -- Add daily_capacity for maximum bookings per day
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='attraction_availability' AND column_name='daily_capacity') THEN
    ALTER TABLE attraction_availability ADD COLUMN daily_capacity INTEGER;
  END IF;
END $$;

-- Add helpful comments
COMMENT ON COLUMN attraction_availability.enable_multi_booking IS 'Enable multi-booking mode: allows multiple bookings for the same day (e.g., for play centers)';
COMMENT ON COLUMN attraction_availability.daily_capacity IS 'Maximum number of bookings/tickets that can be sold per day when multi-booking is enabled';

-- Add check constraint to ensure daily_capacity is positive when multi-booking is enabled
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'check_daily_capacity_when_multi_booking'
  ) THEN
    ALTER TABLE attraction_availability 
    ADD CONSTRAINT check_daily_capacity_when_multi_booking 
    CHECK (
      (enable_multi_booking = false) OR 
      (enable_multi_booking = true AND daily_capacity IS NOT NULL AND daily_capacity > 0)
    );
  END IF;
END $$;
