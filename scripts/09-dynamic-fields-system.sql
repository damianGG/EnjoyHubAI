-- Add role field to users table for super admin functionality
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('user', 'host', 'super_admin');
  END IF;
END $$;

ALTER TABLE users ADD COLUMN IF NOT EXISTS role user_role DEFAULT 'user';

-- Update existing users based on is_host field
UPDATE users SET role = 'host' WHERE is_host = true AND role = 'user';

-- Create index for role-based queries
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Create category_fields table for dynamic field definitions
CREATE TABLE IF NOT EXISTS category_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  field_label TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (field_type IN ('text', 'textarea', 'number', 'select', 'checkbox', 'file')),
  field_order INTEGER NOT NULL DEFAULT 0,
  is_required BOOLEAN DEFAULT false,
  validation_rules JSONB DEFAULT '{}',
  options JSONB DEFAULT '[]', -- For select field type
  placeholder TEXT,
  help_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(category_id, field_name)
);

-- Create object_field_values table for storing dynamic field values
CREATE TABLE IF NOT EXISTS object_field_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  field_id UUID REFERENCES category_fields(id) ON DELETE CASCADE,
  value TEXT, -- Stores the actual value (text, number as string, selected option, etc.)
  file_url TEXT, -- For file type fields
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(property_id, field_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_category_fields_category ON category_fields(category_id);
CREATE INDEX IF NOT EXISTS idx_category_fields_order ON category_fields(category_id, field_order);
CREATE INDEX IF NOT EXISTS idx_object_field_values_property ON object_field_values(property_id);
CREATE INDEX IF NOT EXISTS idx_object_field_values_field ON object_field_values(field_id);

-- Enable Row Level Security
ALTER TABLE category_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE object_field_values ENABLE ROW LEVEL SECURITY;

-- RLS Policies for category_fields table
-- Anyone can view category fields
CREATE POLICY "Anyone can view category fields" ON category_fields
  FOR SELECT TO authenticated, anon
  USING (true);

-- Only super admins can manage category fields
CREATE POLICY "Super admins can manage category fields" ON category_fields
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- RLS Policies for object_field_values table
-- Anyone can view field values for active properties
CREATE POLICY "Anyone can view field values" ON object_field_values
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM properties 
      WHERE id = property_id AND is_active = true
    )
  );

-- Property owners can manage their field values
CREATE POLICY "Property owners can manage field values" ON object_field_values
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM properties 
      WHERE id = property_id AND host_id = auth.uid()
    )
  );

-- Update existing categories to have some default fields
-- This is optional but helps with initial setup
INSERT INTO category_fields (category_id, field_name, field_label, field_type, field_order, is_required, placeholder) 
SELECT 
  c.id,
  'minimum_age',
  'Minimum Age',
  'number',
  1,
  false,
  'Enter minimum age requirement'
FROM categories c
WHERE NOT EXISTS (
  SELECT 1 FROM category_fields cf 
  WHERE cf.category_id = c.id AND cf.field_name = 'minimum_age'
);

INSERT INTO category_fields (category_id, field_name, field_label, field_type, field_order, is_required, placeholder) 
SELECT 
  c.id,
  'opening_hours',
  'Opening Hours',
  'text',
  2,
  false,
  'e.g., Mon-Fri: 9AM-6PM'
FROM categories c
WHERE NOT EXISTS (
  SELECT 1 FROM category_fields cf 
  WHERE cf.category_id = c.id AND cf.field_name = 'opening_hours'
);

-- Grant permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON category_fields TO anon, authenticated;
GRANT SELECT ON object_field_values TO anon, authenticated;
GRANT ALL ON category_fields TO authenticated;
GRANT ALL ON object_field_values TO authenticated;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_category_fields_updated_at ON category_fields;
CREATE TRIGGER update_category_fields_updated_at
  BEFORE UPDATE ON category_fields
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_object_field_values_updated_at ON object_field_values;
CREATE TRIGGER update_object_field_values_updated_at
  BEFORE UPDATE ON object_field_values
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
