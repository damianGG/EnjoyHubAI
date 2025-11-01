-- Sample data for testing the dynamic fields system
-- This script adds example fields for different categories

-- First, ensure we have the base categories
INSERT INTO categories (id, name, slug, icon, description, created_at) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'Go-Karts', 'go-karts', '🏎️', 'Trasy gokartowe i wyścigi', NOW()),
  ('550e8400-e29b-41d4-a716-446655440002', 'Paintball', 'paintball', '🎯', 'Gry paintballowe i laser tag', NOW()),
  ('550e8400-e29b-41d4-a716-446655440003', 'Dmuchańce', 'dmuchance', '🎈', 'Dmuchane atrakcje dla dzieci', NOW()),
  ('550e8400-e29b-41d4-a716-446655440004', 'Mini Golf', 'mini-golf', '⛳', 'Kreatywne tory mini golfa', NOW()),
  ('550e8400-e29b-41d4-a716-446655440005', 'Escape Room', 'escape-room', '🔐', 'Pokoje zagadek i ucieczek', NOW())
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  description = EXCLUDED.description;

-- Fields for Go-Karts
INSERT INTO category_fields (category_id, field_name, field_label, field_type, field_order, is_required, validation_rules, options, placeholder, help_text) VALUES
  ((SELECT id FROM categories WHERE slug = 'go-karts'), 'minimum_age', 'Minimum Age', 'number', 1, true, '{"min": 3, "max": 100}', '[]', 'e.g., 8', 'Minimum age required to participate'),
  ((SELECT id FROM categories WHERE slug = 'go-karts'), 'track_length', 'Track Length (meters)', 'number', 2, false, '{"min": 50}', '[]', 'e.g., 500', 'Length of the go-kart track in meters'),
  ((SELECT id FROM categories WHERE slug = 'go-karts'), 'kart_type', 'Kart Type', 'select', 3, true, '{}', '["Electric", "Gas", "Both"]', NULL, 'Type of go-karts available'),
  ((SELECT id FROM categories WHERE slug = 'go-karts'), 'has_safety_gear', 'Provides Safety Gear', 'checkbox', 4, false, '{}', '[]', NULL, 'Check if helmets and safety equipment are provided'),
  ((SELECT id FROM categories WHERE slug = 'go-karts'), 'opening_hours', 'Opening Hours', 'text', 5, true, '{"minLength": 3, "maxLength": 100}', '[]', 'Mon-Sun: 9AM-8PM', 'Operating hours of the facility')
ON CONFLICT (category_id, field_name) DO NOTHING;

-- Fields for Paintball
INSERT INTO category_fields (category_id, field_name, field_label, field_type, field_order, is_required, validation_rules, options, placeholder, help_text) VALUES
  ((SELECT id FROM categories WHERE slug = 'paintball'), 'minimum_age', 'Minimum Age', 'number', 1, true, '{"min": 6, "max": 100}', '[]', 'e.g., 12', 'Minimum age to participate'),
  ((SELECT id FROM categories WHERE slug = 'paintball'), 'field_size', 'Field Size (hectares)', 'number', 2, false, '{"min": 0.1}', '[]', 'e.g., 2.5', 'Size of the playing field'),
  ((SELECT id FROM categories WHERE slug = 'paintball'), 'game_types', 'Game Types', 'select', 3, true, '{}', '["Capture the Flag", "Team Deathmatch", "Scenario Games", "All Types"]', NULL, 'Types of paintball games offered'),
  ((SELECT id FROM categories WHERE slug = 'paintball'), 'equipment_included', 'Equipment Included', 'checkbox', 4, false, '{}', '[]', NULL, 'Check if paintball gun and protective gear are included'),
  ((SELECT id FROM categories WHERE slug = 'paintball'), 'indoor_outdoor', 'Indoor/Outdoor', 'select', 5, true, '{}', '["Indoor", "Outdoor", "Both"]', NULL, 'Type of playing environment')
ON CONFLICT (category_id, field_name) DO NOTHING;

-- Fields for Dmuchańce (Inflatables)
INSERT INTO category_fields (category_id, field_name, field_label, field_type, field_order, is_required, validation_rules, options, placeholder, help_text) VALUES
  ((SELECT id FROM categories WHERE slug = 'dmuchance'), 'minimum_age', 'Minimum Age', 'number', 1, true, '{"min": 1, "max": 100}', '[]', 'e.g., 3', 'Minimum age for children'),
  ((SELECT id FROM categories WHERE slug = 'dmuchance'), 'max_weight', 'Maximum Weight (kg)', 'number', 2, false, '{"min": 10}', '[]', 'e.g., 50', 'Maximum weight limit per child'),
  ((SELECT id FROM categories WHERE slug = 'dmuchance'), 'size', 'Inflatable Size', 'select', 3, true, '{}', '["Small (up to 20m²)", "Medium (20-50m²)", "Large (50-100m²)", "Extra Large (100m²+)"]', NULL, 'Size category of the inflatable'),
  ((SELECT id FROM categories WHERE slug = 'dmuchance'), 'supervised', 'Adult Supervision Provided', 'checkbox', 4, false, '{}', '[]', NULL, 'Check if adult supervision is provided'),
  ((SELECT id FROM categories WHERE slug = 'dmuchance'), 'themes', 'Themes Available', 'textarea', 5, false, '{}', '[]', 'Castle, Princess, Jungle, etc.', 'List available themes')
ON CONFLICT (category_id, field_name) DO NOTHING;

-- Fields for Mini Golf
INSERT INTO category_fields (category_id, field_name, field_label, field_type, field_order, is_required, validation_rules, options, placeholder, help_text) VALUES
  ((SELECT id FROM categories WHERE slug = 'mini-golf'), 'minimum_age', 'Minimum Age', 'number', 1, false, '{"min": 1, "max": 100}', '[]', 'e.g., 5', 'Recommended minimum age'),
  ((SELECT id FROM categories WHERE slug = 'mini-golf'), 'hole_count', 'Number of Holes', 'number', 2, true, '{"min": 6, "max": 36}', '[]', 'e.g., 18', 'Total number of holes on the course'),
  ((SELECT id FROM categories WHERE slug = 'mini-golf'), 'difficulty', 'Difficulty Level', 'select', 3, true, '{}', '["Easy", "Medium", "Hard", "Mixed"]', NULL, 'Overall difficulty of the course'),
  ((SELECT id FROM categories WHERE slug = 'mini-golf'), 'themed', 'Themed Course', 'checkbox', 4, false, '{}', '[]', NULL, 'Check if the course has a special theme'),
  ((SELECT id FROM categories WHERE slug = 'mini-golf'), 'theme_description', 'Theme Description', 'textarea', 5, false, '{"maxLength": 200}', '[]', 'Pirate adventure, Jungle, etc.', 'Describe the course theme if applicable')
ON CONFLICT (category_id, field_name) DO NOTHING;

-- Fields for Escape Room
INSERT INTO category_fields (category_id, field_name, field_label, field_type, field_order, is_required, validation_rules, options, placeholder, help_text) VALUES
  ((SELECT id FROM categories WHERE slug = 'escape-room'), 'minimum_age', 'Minimum Age', 'number', 1, true, '{"min": 6, "max": 100}', '[]', 'e.g., 12', 'Minimum age to participate'),
  ((SELECT id FROM categories WHERE slug = 'escape-room'), 'team_size', 'Team Size', 'text', 2, true, '{"minLength": 3, "maxLength": 50}', '[]', 'e.g., 2-6 players', 'Recommended team size'),
  ((SELECT id FROM categories WHERE slug = 'escape-room'), 'difficulty', 'Difficulty Level', 'select', 3, true, '{}', '["Beginner", "Intermediate", "Advanced", "Expert"]', NULL, 'Puzzle difficulty level'),
  ((SELECT id FROM categories WHERE slug = 'escape-room'), 'duration', 'Duration (minutes)', 'number', 4, true, '{"min": 15, "max": 180}', '[]', 'e.g., 60', 'Time limit to complete the room'),
  ((SELECT id FROM categories WHERE slug = 'escape-room'), 'room_themes', 'Room Themes', 'textarea', 5, true, '{"maxLength": 300}', '[]', 'Horror, Mystery, Sci-Fi, etc.', 'List all available room themes'),
  ((SELECT id FROM categories WHERE slug = 'escape-room'), 'scary', 'Contains Scary Elements', 'checkbox', 6, false, '{}', '[]', NULL, 'Check if the room has horror/scary elements')
ON CONFLICT (category_id, field_name) DO NOTHING;

-- Display success message
DO $$ 
BEGIN
  RAISE NOTICE 'Sample data inserted successfully!';
  RAISE NOTICE 'Categories: %', (SELECT COUNT(*) FROM categories);
  RAISE NOTICE 'Category Fields: %', (SELECT COUNT(*) FROM category_fields);
END $$;
