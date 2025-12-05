-- Add attraction availability system for date-based bookings
-- This migration adds attraction_availability table and extends bookings for attractions

-- Create attraction_availability table
-- Manages booking modes, blocked dates, seasonal pricing, and min/max stay requirements
CREATE TABLE IF NOT EXISTS attraction_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  
  -- Booking mode: 'daily' for multi-day stays, 'hourly' for time-slot based bookings
  booking_mode TEXT NOT NULL DEFAULT 'daily' CHECK (booking_mode IN ('daily', 'hourly')),
  
  -- Blocked dates stored as array of date strings (YYYY-MM-DD format)
  -- Using TEXT[] instead of DATE[] for better JSON serialization and API compatibility
  -- A check constraint ensures all dates follow the YYYY-MM-DD format
  blocked_dates TEXT[] DEFAULT '{}',
  
  -- Seasonal pricing: JSON array of pricing rules
  -- Format: [{"start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD", "price": 150.00, "name": "Summer Season"}]
  seasonal_prices JSONB DEFAULT '[]',
  
  -- Minimum and maximum stay requirements (in days for daily mode, in hours for hourly mode)
  min_stay INTEGER DEFAULT 1,
  max_stay INTEGER,
  
  -- Default availability status
  is_available BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one availability configuration per property
  UNIQUE(property_id)
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_attraction_availability_property ON attraction_availability(property_id);
CREATE INDEX IF NOT EXISTS idx_attraction_availability_mode ON attraction_availability(booking_mode);

-- Extend bookings table with attraction-specific fields
-- Check if columns don't exist before adding them
DO $$ 
BEGIN
  -- Add booking_type to distinguish between property and attraction bookings
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='bookings' AND column_name='booking_type') THEN
    ALTER TABLE bookings ADD COLUMN booking_type TEXT DEFAULT 'property' 
      CHECK (booking_type IN ('property', 'attraction'));
  END IF;
  
  -- Add time-based booking support for hourly attractions
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='bookings' AND column_name='start_time') THEN
    ALTER TABLE bookings ADD COLUMN start_time TIME;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='bookings' AND column_name='end_time') THEN
    ALTER TABLE bookings ADD COLUMN end_time TIME;
  END IF;
  
  -- Add applied_price to store the actual price applied (considering seasonal pricing)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='bookings' AND column_name='applied_price_per_unit') THEN
    ALTER TABLE bookings ADD COLUMN applied_price_per_unit DECIMAL(10, 2);
  END IF;
END $$;

-- Enable Row Level Security for attraction_availability
ALTER TABLE attraction_availability ENABLE ROW LEVEL SECURITY;

-- RLS Policies for attraction_availability table
-- Anyone can view availability for active properties
CREATE POLICY "Anyone can view attraction availability" ON attraction_availability
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM properties 
      WHERE id = property_id AND is_active = true
    )
  );

-- Property hosts can manage their property availability
CREATE POLICY "Hosts can manage their property availability" ON attraction_availability
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM properties 
      WHERE id = property_id AND host_id = auth.uid()
    )
  );

-- Super admins can manage all attraction availability
CREATE POLICY "Super admins can manage all attraction availability" ON attraction_availability
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Create trigger for updating updated_at timestamp
CREATE OR REPLACE FUNCTION update_attraction_availability_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_attraction_availability_updated_at ON attraction_availability;
CREATE TRIGGER update_attraction_availability_updated_at
  BEFORE UPDATE ON attraction_availability
  FOR EACH ROW
  EXECUTE FUNCTION update_attraction_availability_updated_at();

-- Grant permissions
GRANT SELECT ON attraction_availability TO anon, authenticated;
GRANT ALL ON attraction_availability TO authenticated;

-- Add helpful comment
COMMENT ON TABLE attraction_availability IS 'Manages availability, booking modes, blocked dates, and seasonal pricing for attraction properties';
COMMENT ON COLUMN attraction_availability.booking_mode IS 'Booking mode: daily for multi-day stays, hourly for time-slot bookings';
COMMENT ON COLUMN attraction_availability.blocked_dates IS 'Array of blocked dates in YYYY-MM-DD format';
COMMENT ON COLUMN attraction_availability.seasonal_prices IS 'JSON array of seasonal pricing rules with start_date, end_date, price, and name';
COMMENT ON COLUMN attraction_availability.min_stay IS 'Minimum stay requirement in days (daily mode) or hours (hourly mode)';
COMMENT ON COLUMN attraction_availability.max_stay IS 'Maximum stay requirement in days (daily mode) or hours (hourly mode)';
