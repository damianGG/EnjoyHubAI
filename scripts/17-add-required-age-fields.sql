-- Add maximum_age field to all existing categories
-- This script ensures all categories have both minimum_age and maximum_age fields

-- Add maximum_age field to categories that don't have it yet
INSERT INTO category_fields (category_id, field_name, field_label, field_type, field_order, is_required, validation_rules, options, placeholder, help_text)
SELECT 
  c.id,
  'maximum_age',
  'Maximum Age',
  'number',
  -- Set field_order to be after existing fields
  COALESCE((SELECT MAX(field_order) + 1 FROM category_fields WHERE category_id = c.id), 10),
  false,
  '{"min": 0, "max": 150}',
  '[]',
  'e.g., 99',
  'Maximum age allowed to participate (leave empty for no limit)'
FROM categories c
WHERE NOT EXISTS (
  SELECT 1 FROM category_fields cf 
  WHERE cf.category_id = c.id AND cf.field_name = 'maximum_age'
);

-- Also ensure minimum_age exists for all categories (in case some don't have it)
INSERT INTO category_fields (category_id, field_name, field_label, field_type, field_order, is_required, validation_rules, options, placeholder, help_text)
SELECT 
  c.id,
  'minimum_age',
  'Minimum Age',
  'number',
  -- Set field_order to be before maximum_age
  COALESCE((SELECT MAX(field_order) + 1 FROM category_fields WHERE category_id = c.id), 0),
  false,
  '{"min": 0, "max": 100}',
  '[]',
  'e.g., 3',
  'Minimum age required to participate'
FROM categories c
WHERE NOT EXISTS (
  SELECT 1 FROM category_fields cf 
  WHERE cf.category_id = c.id AND cf.field_name = 'minimum_age'
);

-- Display success message
DO $$ 
BEGIN
  RAISE NOTICE 'Required age fields added to all categories!';
  RAISE NOTICE 'Categories with minimum_age: %', (SELECT COUNT(DISTINCT category_id) FROM category_fields WHERE field_name = 'minimum_age');
  RAISE NOTICE 'Categories with maximum_age: %', (SELECT COUNT(DISTINCT category_id) FROM category_fields WHERE field_name = 'maximum_age');
END $$;
