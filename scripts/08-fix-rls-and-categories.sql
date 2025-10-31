-- Fix RLS policies and permissions for categories table
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if exists
DROP POLICY IF EXISTS "Anyone can view categories" ON public.categories;

-- Create new policy allowing everyone to view categories
CREATE POLICY "Anyone can view categories"
  ON public.categories
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- Grant explicit permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.categories TO anon, authenticated;

-- Unify category slugs (use 'dmuchance' consistently)
UPDATE public.categories
SET slug = 'dmuchance'
WHERE slug IN ('dmuchaniec', 'dmuchance');

-- Clean up any duplicate categories, keep only dmuchance and paintball
DELETE FROM public.categories 
WHERE slug NOT IN ('dmuchance', 'paintball');

-- Ensure we have the two main categories
INSERT INTO public.categories (id, name, slug, icon, description, created_at)
VALUES 
  (gen_random_uuid(), 'Dmuchańce', 'dmuchance', '🎈', 'Dmuchane atrakcje i zabawki', NOW()),
  (gen_random_uuid(), 'Paintball', 'paintball', '🎯', 'Gry paintballowe i laser tag', NOW())
ON CONFLICT (slug) DO NOTHING;
