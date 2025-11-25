-- Add time-based booking system for activities and offers
-- This migration adds three tables: offers, offer_availability, and offer_bookings
-- These tables enable venues/properties to offer time-slot based bookings for activities

-- Create offers table
-- Offers are specific activities/services that can be booked at a property (e.g., birthday party, escape room session)
CREATE TABLE IF NOT EXISTS offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  base_price NUMERIC(10, 2) NOT NULL, -- stored in smallest currency unit (e.g., 100.00 PLN)
  currency TEXT NOT NULL DEFAULT 'PLN',
  duration_minutes INTEGER NOT NULL, -- how long the activity lasts (e.g., 60, 90, 120)
  min_participants INTEGER, -- minimum number of people required (nullable)
  max_participants INTEGER, -- maximum capacity (nullable)
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create offer_availability table
-- Defines recurring weekly availability slots for each offer
CREATE TABLE IF NOT EXISTS offer_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  weekday INTEGER NOT NULL CHECK (weekday >= 0 AND weekday <= 6), -- 0 = Monday, 1 = Tuesday, ..., 6 = Sunday (custom convention, not ISO 8601)
  start_time TIME NOT NULL, -- start of availability window (e.g., '10:00')
  end_time TIME NOT NULL, -- end of availability window (e.g., '20:00')
  slot_length_minutes INTEGER NOT NULL, -- length of each bookable slot (e.g., 60, 90)
  max_bookings_per_slot INTEGER NOT NULL DEFAULT 1, -- 1 for exclusive (birthday party), >1 for shared (open entry)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create offer_bookings table
-- Stores actual customer bookings for specific time slots
CREATE TABLE IF NOT EXISTS offer_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  place_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE, -- duplicated for easier querying
  booking_date DATE NOT NULL, -- the date of the booking
  start_time TIME NOT NULL, -- chosen slot start time
  end_time TIME NOT NULL, -- derived from start_time + duration_minutes
  persons INTEGER NOT NULL, -- number of participants
  -- Status field: tracks the booking lifecycle
  -- 'pending' = newly created, awaiting confirmation
  -- 'confirmed' = booking is confirmed (can be used after payment or manual approval)
  -- 'cancelled' = booking was cancelled by customer or venue
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  -- Payment status: ready for future payment integration
  -- 'not_required' = free activity or payment handled offline
  -- 'pending' = payment required but not yet completed
  -- 'paid' = payment successfully processed
  -- 'failed' = payment attempt failed
  payment_status TEXT NOT NULL DEFAULT 'not_required' CHECK (payment_status IN ('not_required', 'pending', 'paid', 'failed')),
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- optional link to registered user
  source TEXT NOT NULL DEFAULT 'online_enjoyhub' CHECK (source IN ('online_enjoyhub', 'phone', 'walk_in')), -- tracks where booking came from
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_offers_place ON offers(place_id);
CREATE INDEX IF NOT EXISTS idx_offers_active ON offers(is_active);
CREATE INDEX IF NOT EXISTS idx_offer_availability_offer ON offer_availability(offer_id);
CREATE INDEX IF NOT EXISTS idx_offer_availability_weekday ON offer_availability(weekday);
CREATE INDEX IF NOT EXISTS idx_offer_bookings_offer ON offer_bookings(offer_id);
CREATE INDEX IF NOT EXISTS idx_offer_bookings_place ON offer_bookings(place_id);
CREATE INDEX IF NOT EXISTS idx_offer_bookings_date ON offer_bookings(booking_date);
CREATE INDEX IF NOT EXISTS idx_offer_bookings_status ON offer_bookings(status);
CREATE INDEX IF NOT EXISTS idx_offer_bookings_payment_status ON offer_bookings(payment_status);

-- Enable Row Level Security
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE offer_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE offer_bookings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for offers table
-- Anyone can view active offers
CREATE POLICY "Anyone can view active offers" ON offers
  FOR SELECT USING (is_active = true);

-- Property hosts can manage their own offers
CREATE POLICY "Hosts can manage their property offers" ON offers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM properties 
      WHERE id = place_id AND host_id = auth.uid()
    )
  );

-- Super admins can manage all offers
CREATE POLICY "Super admins can manage all offers" ON offers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- RLS Policies for offer_availability table
-- Anyone can view availability for active offers
CREATE POLICY "Anyone can view offer availability" ON offer_availability
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM offers 
      WHERE id = offer_id AND is_active = true
    )
  );

-- Property hosts can manage availability for their offers
CREATE POLICY "Hosts can manage their offer availability" ON offer_availability
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM offers o
      JOIN properties p ON o.place_id = p.id
      WHERE o.id = offer_id AND p.host_id = auth.uid()
    )
  );

-- Super admins can manage all offer availability
CREATE POLICY "Super admins can manage all offer availability" ON offer_availability
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- RLS Policies for offer_bookings table
-- Authenticated users can view their own bookings (by user_id or email)
CREATE POLICY "Users can view their own offer bookings" ON offer_bookings
  FOR SELECT USING (
    user_id = auth.uid() OR 
    customer_email = (SELECT email FROM users WHERE id = auth.uid())
  );

-- Property hosts can view bookings for their offers
CREATE POLICY "Hosts can view bookings for their offers" ON offer_bookings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM properties 
      WHERE id = place_id AND host_id = auth.uid()
    )
  );

-- Authenticated users can create bookings
CREATE POLICY "Authenticated users can create offer bookings" ON offer_bookings
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Hosts can update bookings for their offers (e.g., confirm, cancel)
CREATE POLICY "Hosts can update their offer bookings" ON offer_bookings
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM properties 
      WHERE id = place_id AND host_id = auth.uid()
    )
  );

-- Super admins can manage all bookings
CREATE POLICY "Super admins can manage all offer bookings" ON offer_bookings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Create trigger for updating updated_at timestamp on offers
DROP TRIGGER IF EXISTS update_offers_updated_at ON offers;
CREATE TRIGGER update_offers_updated_at
  BEFORE UPDATE ON offers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT SELECT ON offers TO anon, authenticated;
GRANT SELECT ON offer_availability TO anon, authenticated;
GRANT SELECT ON offer_bookings TO authenticated;
GRANT ALL ON offers TO authenticated;
GRANT ALL ON offer_availability TO authenticated;
GRANT ALL ON offer_bookings TO authenticated;
