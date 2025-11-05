# Search and Map Experience Implementation

This branch implements a complete search and map experience with URL-based state management and SEO-friendly category routes.

## Changes Summary

### 1. API Endpoint for Search (`app/api/search/route.ts`)
- **New file**: API endpoint for searching properties
- **Accepts query parameters**:
  - `q`: Search query (ilike on title)
  - `bbox`: Bounding box filter in "w,s,e,n" format
  - `categories`: Comma-separated category slugs
  - `sort`: Sort option (relevance|rating|price_asc|price_desc|newest)
  - `page`: Page number (default: 1)
  - `per`: Results per page (default: 20)
- **Features**:
  - Queries Supabase with joins to categories and reviews
  - Filters by is_active=true, optional categories, optional bbox, optional search query
  - Pagination via range() with exact count
  - Returns JSON: { items, total, page, per }
  - Computes avg_rating from reviews

### 2. URL State Helper (`lib/search/url-state.ts`)
- **New file**: React hook for managing URL search params
- **Exports `useUrlState()` hook** with:
  - `get(key)`: Get a specific query parameter value
  - `setMany(updates, options)`: Update multiple query parameters at once
  - **Debouncing support**: Optional debounce parameter for smooth URL updates
- Uses Next.js App Router hooks (useSearchParams, useRouter, usePathname)
- Replaces URL without adding to history (scroll: false)

### 3. Category Search Page (`app/k/[categories]/page.tsx`)
- **New file**: Dynamic route for category-based property search
- **Features**:
  - Client component with responsive layout
  - Left panel: Property list with search, sorting, and pagination
  - Right panel: Leaflet map (hidden on mobile)
  - Reads [categories] from route params and syncs to query param
  - Watches q, bbox, sort, page, per, categories and fetches from API
  - Map initialization centered on Poland (52.0, 19.0)
  - Map moveend debounced to update bbox in URL (6 decimal precision)
  - Automatically resets to page 1 when filters change
  - fitBounds if bbox exists initially

### 4. Updated CategoryBar (`components/category-bar.tsx`)
- **Modified existing component** for SEO-friendly navigation
- On category click: Navigates to `/k/{slug}` via router.push
- On "Wszystkie" (All) click: Navigates to homepage `/`
- **Backward compatible**: Still calls onCategorySelect callback if provided
- Made onCategorySelect optional to support new navigation pattern
- Maintains all existing styling and UX

### 5. Database Indexes Script (`scripts/12-geo-indexes.sql`)
- **New file**: SQL script for geographic and search indexes
- **PostGIS setup** (commented out, optional):
  - Extension creation
  - Geometry column with GIST index
  - Trigger to keep geom column updated
- **Fallback indexes** (active by default):
  - BTREE indexes on latitude, longitude
  - Composite index for lat/lng together
- **Performance indexes**:
  - is_active, category_id, categories.slug
  - Composite indexes for common query patterns
  - Title search (case-insensitive)
  - Price and created_at for sorting
- **Future enhancements** (commented):
  - pg_trgm for full-text search
  - Materialized view for average ratings

### 6. Documentation Updates (`docs/SETUP_GUIDE.md`)
- Added step 6: Geographic indexes script
- Note about PostGIS being optional
- Explanation of bbox fallback using BTREE indexes
- **New section**: "Test Search and Map Features" with:
  - Category search page access instructions
  - URL parameter testing examples
  - Map interaction testing
  - Category navigation testing
  - Pagination testing
  - Manual API testing with curl examples

### 7. Dependencies
- Added `@types/leaflet` as dev dependency for TypeScript support
- No new production dependencies (leaflet already exists)

## Technical Details

### URL State Management
- Debounced URL updates prevent excessive history entries
- URL is the source of truth for all filters and pagination
- Allows shareable/bookmarkable search results
- Browser back/forward buttons work correctly

### Map Integration
- Uses existing PropertyMap component pattern
- Leaflet map loads asynchronously on client
- Bbox updates trigger new searches with ~300ms debounce
- Map markers show price per night
- Click markers to see property popups

### API Design
- RESTful GET endpoint at /api/search
- Accepts standard query parameters
- Returns paginated results with total count
- Handles missing/invalid parameters gracefully
- Compatible with future PostGIS distance sorting

### SEO Benefits
- Category pages have clean URLs: `/k/paintball`, `/k/gokarty`
- Multiple categories supported: `/k/paintball,gokarty`
- Search queries in URL: `/k/paintball?q=indoor&sort=price_asc`
- No client-side state needed for initial render
- Crawlable, indexable category pages

## Testing

### Build Status
✅ TypeScript compilation passes
✅ Next.js build succeeds
✅ All routes generate successfully

### Manual Testing Required
Due to lack of Supabase credentials in sandbox, the following should be tested with real credentials:

1. Navigate to `/k/[category-slug]` (e.g., `/k/paintball`)
2. Verify property list loads from API
3. Test search input updates URL and results
4. Test sort dropdown changes URL and results
5. Pan/zoom map and verify bbox updates in URL
6. Test pagination controls
7. Click CategoryBar categories and verify navigation to `/k/{slug}`
8. Click "Wszystkie" and verify navigation to `/`
9. Run database script `scripts/12-geo-indexes.sql`
10. Test API directly with curl/Postman

### API Test Examples
```bash
# Basic search
curl "http://localhost:3000/api/search?per=10"

# Search with query
curl "http://localhost:3000/api/search?q=paintball&per=10"

# Search with bbox (Poland)
curl "http://localhost:3000/api/search?bbox=14.0,49.0,24.0,55.0&per=10"

# Search with category
curl "http://localhost:3000/api/search?categories=paintball&sort=price_asc"

# Combined search
curl "http://localhost:3000/api/search?q=fun&categories=paintball,gokarty&sort=rating&page=2&per=20"
```

## Future Enhancements

As noted in the requirements, future PRs will add:
- PostGIS distance sorting
- pg_trgm relevance scoring
- Materialized view for average ratings
- Full-text search improvements

## Files Changed
- `app/api/search/route.ts` (new)
- `app/k/[categories]/page.tsx` (new)
- `lib/search/url-state.ts` (new)
- `scripts/12-geo-indexes.sql` (new)
- `components/category-bar.tsx` (modified)
- `app/page.tsx` (minor type fix)
- `docs/SETUP_GUIDE.md` (updated)
- `package.json` (added @types/leaflet)

Total: 9 files changed, 781 insertions(+), 9 deletions(-)
