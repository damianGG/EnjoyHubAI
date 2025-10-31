-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  icon TEXT NOT NULL, -- icon name for lucide-react
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default categories
INSERT INTO categories (name, slug, icon, description) VALUES
  ('Place zabaw', 'place-zabaw', 'Baby', 'Miejsca zabaw dla dzieci'),
  ('Trampoliny', 'trampoliny', 'Zap', 'Parki trampolin i skoki'),
  ('Gokarty', 'gokarty', 'Car', 'Tory gokartowe i wyścigi'),
  ('Paintball', 'paintball', 'Target', 'Gry paintballowe i laser tag'),
  ('Restauracje dla dzieci', 'restauracje-dzieci', 'UtensilsCrossed', 'Restauracje przyjazne dzieciom'),
  ('Ekstremalne', 'ekstremalne', 'Mountain', 'Sporty ekstremalne i przygoda')
ON CONFLICT (slug) DO NOTHING;

-- Add category_id to properties table
ALTER TABLE properties ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id);

-- Create index for category filtering
CREATE INDEX IF NOT EXISTS idx_properties_category ON properties(category_id);

-- Enable RLS for categories
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- RLS Policy for categories (anyone can view)
CREATE POLICY "Anyone can view categories" ON categories
  FOR SELECT TO authenticated, anon;
