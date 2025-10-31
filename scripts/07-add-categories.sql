-- Dodaj kategorie dmuchańce i paintball
INSERT INTO categories (id, name, slug, icon, description, created_at) VALUES
(gen_random_uuid(), 'Dmuchańce', 'dmuchaniec', '🎈', 'Dmuchane atrakcje i zabawki', now()),
(gen_random_uuid(), 'Paintball', 'paintball', '🎯', 'Gry paintballowe i laser tag', now())
ON CONFLICT (slug) DO NOTHING;

-- Aktualizuj wszystkie istniejące obiekty żeby miały kategorię paintball
UPDATE properties 
SET category_id = (SELECT id FROM categories WHERE slug = 'paintball' LIMIT 1)
WHERE category_id IS NULL OR category_id NOT IN (SELECT id FROM categories);
