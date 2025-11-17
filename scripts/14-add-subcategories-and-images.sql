-- Add image fields to categories table
ALTER TABLE categories 
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS image_public_id TEXT;

-- Add RLS policy for categories to allow super admin to manage them
-- First, drop existing policy if it exists to avoid conflicts
DROP POLICY IF EXISTS "Super admin can manage categories" ON categories;

-- Create policy for super admin to INSERT/UPDATE/DELETE categories
CREATE POLICY "Super admin can manage categories" ON categories
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'super_admin'
    )
  );

-- Create subcategories table
CREATE TABLE IF NOT EXISTS subcategories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  icon TEXT,
  description TEXT,
  image_url TEXT,
  image_public_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(parent_category_id, slug)
);

-- Create index for subcategory filtering
CREATE INDEX IF NOT EXISTS idx_subcategories_parent ON subcategories(parent_category_id);

-- Enable RLS for subcategories
ALTER TABLE subcategories ENABLE ROW LEVEL SECURITY;

-- RLS Policy for subcategories (anyone can view)
CREATE POLICY "Anyone can view subcategories" ON subcategories
  FOR SELECT TO authenticated, anon
  USING (true);

-- RLS Policy for subcategories (only super admin can modify)
CREATE POLICY "Super admin can manage subcategories" ON subcategories
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'super_admin'
    )
  );

-- Add subcategory_id to properties table (optional - properties can belong to category or subcategory)
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS subcategory_id UUID REFERENCES subcategories(id);

-- Create index for subcategory filtering on properties
CREATE INDEX IF NOT EXISTS idx_properties_subcategory ON properties(subcategory_id);
