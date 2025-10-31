-- Clear existing categories and add only two new ones: dmuchańce and paintball
DELETE FROM categories;

-- Insert new categories
INSERT INTO categories (id, name, slug, icon, description, created_at) VALUES
(gen_random_uuid(), 'Dmuchańce', 'dmuchance', '🎈', 'Dmuchane atrakcje i zabawki', NOW()),
(gen_random_uuid(), 'Paintball', 'paintball', '🎯', 'Gry paintballowe i laser tag', NOW());

-- Update all existing properties to use paintball category
UPDATE properties 
SET category_id = (SELECT id FROM categories WHERE slug = 'paintball')
WHERE category_id IS NOT NULL;
