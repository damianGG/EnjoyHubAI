-- Geographic Indexes for Property Search
-- This script sets up indexes for efficient property searches with optional PostGIS support

-- ============================================================================
-- OPTION 1: PostGIS Setup (Optional - Provides Best Performance)
-- ============================================================================
-- If you have PostGIS enabled, uncomment the following sections:

-- Enable PostGIS extension
-- CREATE EXTENSION IF NOT EXISTS postgis;

-- Add geometry column (Point type for property locations)
-- SELECT AddGeometryColumn('public', 'properties', 'geom', 4326, 'POINT', 2);

-- Update geometry column from latitude/longitude
-- UPDATE properties 
-- SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
-- WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Create GIST index on geometry column for spatial queries
-- CREATE INDEX IF NOT EXISTS idx_properties_geom ON properties USING GIST (geom);

-- Create trigger to keep geom column updated
-- CREATE OR REPLACE FUNCTION update_properties_geom()
-- RETURNS TRIGGER AS $$
-- BEGIN
--   IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
--     NEW.geom := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
--   END IF;
--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;

-- DROP TRIGGER IF EXISTS trigger_update_properties_geom ON properties;
-- CREATE TRIGGER trigger_update_properties_geom
--   BEFORE INSERT OR UPDATE OF latitude, longitude ON properties
--   FOR EACH ROW
--   EXECUTE FUNCTION update_properties_geom();

-- ============================================================================
-- OPTION 2: Fallback Indexes (Works Without PostGIS)
-- ============================================================================
-- These indexes work with standard latitude/longitude columns

-- Index for latitude range queries (used in bbox searches)
CREATE INDEX IF NOT EXISTS idx_properties_latitude ON properties (latitude);

-- Index for longitude range queries (used in bbox searches)
CREATE INDEX IF NOT EXISTS idx_properties_longitude ON properties (longitude);

-- Composite index for lat/lng together (bbox queries)
CREATE INDEX IF NOT EXISTS idx_properties_lat_lng ON properties (latitude, longitude);

-- ============================================================================
-- General Performance Indexes
-- ============================================================================

-- Index for active properties filter
CREATE INDEX IF NOT EXISTS idx_properties_is_active ON properties (is_active);

-- Composite index for active properties with location
CREATE INDEX IF NOT EXISTS idx_properties_active_location 
ON properties (is_active, latitude, longitude) 
WHERE is_active = true AND latitude IS NOT NULL AND longitude IS NOT NULL;

-- Index for category filtering
CREATE INDEX IF NOT EXISTS idx_properties_category_id ON properties (category_id);

-- Composite index for active properties by category
CREATE INDEX IF NOT EXISTS idx_properties_active_category 
ON properties (is_active, category_id) 
WHERE is_active = true;

-- Index on categories slug for SEO-friendly lookups
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories (slug);

-- Index for title search (case-insensitive)
CREATE INDEX IF NOT EXISTS idx_properties_title_lower ON properties (LOWER(title));

-- Index for sorting by price
CREATE INDEX IF NOT EXISTS idx_properties_price ON properties (price_per_night);

-- Index for sorting by creation date (newest)
CREATE INDEX IF NOT EXISTS idx_properties_created_at ON properties (created_at DESC);

-- ============================================================================
-- Full-Text Search (Future Enhancement)
-- ============================================================================
-- For better relevance scoring, consider adding pg_trgm extension:
-- CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- CREATE INDEX IF NOT EXISTS idx_properties_title_trgm ON properties USING GIN (title gin_trgm_ops);

-- ============================================================================
-- Materialized View for Average Ratings (Future Enhancement)
-- ============================================================================
-- For better performance with rating-based sorting:
-- CREATE MATERIALIZED VIEW IF NOT EXISTS property_ratings AS
-- SELECT 
--   property_id,
--   AVG(rating) as avg_rating,
--   COUNT(*) as review_count
-- FROM reviews
-- GROUP BY property_id;

-- CREATE UNIQUE INDEX IF NOT EXISTS idx_property_ratings_property_id ON property_ratings (property_id);

-- Refresh function (call after reviews are added/updated)
-- CREATE OR REPLACE FUNCTION refresh_property_ratings()
-- RETURNS void AS $$
-- BEGIN
--   REFRESH MATERIALIZED VIEW CONCURRENTLY property_ratings;
-- END;
-- $$ LANGUAGE plpgsql;

-- ============================================================================
-- Verification Queries
-- ============================================================================
-- Run these to verify indexes were created successfully:

-- List all indexes on properties table
-- SELECT indexname, indexdef 
-- FROM pg_indexes 
-- WHERE tablename = 'properties' 
-- ORDER BY indexname;

-- Check if PostGIS is available
-- SELECT PostGIS_version();

-- Count properties with location data
-- SELECT COUNT(*) FROM properties WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Test bbox query performance
-- EXPLAIN ANALYZE
-- SELECT id, title, latitude, longitude
-- FROM properties
-- WHERE is_active = true
--   AND latitude BETWEEN 49.0 AND 55.0
--   AND longitude BETWEEN 14.0 AND 24.0;
