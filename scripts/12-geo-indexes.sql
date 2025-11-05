-- Geo-spatial indexes for search optimization
-- This script adds indexes for efficient bbox and location-based queries

-- Optional: Enable PostGIS extension for advanced geo-spatial features
-- Uncomment if PostGIS is available and you want to use ST_Intersects later
-- CREATE EXTENSION IF NOT EXISTS postgis;

-- Optional: Add geometry column for PostGIS spatial queries (future enhancement)
-- Uncomment if using PostGIS
-- ALTER TABLE properties ADD COLUMN IF NOT EXISTS geom geometry(Point, 4326);
-- UPDATE properties SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326) 
-- WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
-- CREATE INDEX IF NOT EXISTS idx_properties_geom ON properties USING GIST(geom);

-- Fallback: Add BTREE indexes for latitude/longitude bbox queries
-- These are used when PostGIS is not available
CREATE INDEX IF NOT EXISTS idx_properties_latitude ON properties(latitude);
CREATE INDEX IF NOT EXISTS idx_properties_longitude ON properties(longitude);

-- Composite index for bbox queries (latitude + longitude)
CREATE INDEX IF NOT EXISTS idx_properties_lat_lng ON properties(latitude, longitude);

-- Index on is_active for filtering active properties
CREATE INDEX IF NOT EXISTS idx_properties_is_active ON properties(is_active) WHERE is_active = true;

-- Index on category_id for category filtering
CREATE INDEX IF NOT EXISTS idx_properties_category_id ON properties(category_id) WHERE category_id IS NOT NULL;

-- Index on categories.slug for fast category lookups
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);

-- Composite index for common query patterns (is_active + category_id)
CREATE INDEX IF NOT EXISTS idx_properties_active_category ON properties(is_active, category_id) WHERE is_active = true;

-- Index on created_at for sorting by newest
CREATE INDEX IF NOT EXISTS idx_properties_created_at ON properties(created_at DESC);

-- Index on price_per_night for price sorting
CREATE INDEX IF NOT EXISTS idx_properties_price ON properties(price_per_night);

-- Index for text search on title (simple ILIKE queries)
CREATE INDEX IF NOT EXISTS idx_properties_title_lower ON properties(LOWER(title));

-- Add comments for documentation
COMMENT ON INDEX idx_properties_latitude IS 'Index for bbox south/north boundary filtering';
COMMENT ON INDEX idx_properties_longitude IS 'Index for bbox west/east boundary filtering';
COMMENT ON INDEX idx_properties_lat_lng IS 'Composite index for efficient bbox queries';
COMMENT ON INDEX idx_properties_is_active IS 'Partial index for active properties';
COMMENT ON INDEX idx_properties_category_id IS 'Index for category filtering';
COMMENT ON INDEX idx_categories_slug IS 'Index for fast category slug lookups';
