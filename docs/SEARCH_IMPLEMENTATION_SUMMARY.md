# Search and Map Implementation Summary

## Overview

This document summarizes the implementation of the search and map experience feature, including architecture decisions, file changes, and integration points.

## Architecture

### URL-Driven State Management

The implementation uses the URL as the single source of truth for all search state:

```
/k/{categories}?q={query}&bbox={west,south,east,north}&sort={sort}&page={page}&per={per}
```

**Benefits:**
- Deep linking: Share URLs to restore exact views
- Browser history: Back/forward buttons work correctly
- SEO-friendly: Categories in path segment
- Stateless: No client-side state synchronization issues

### Components

```
┌─────────────────────────────────────────────────────┐
│ CategoryBar (components/)                           │
│ - Navigation mode: Links to /k/{slug}               │
│ - Callback mode: Local state (backward compatible)  │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│ Search Page (app/k/[categories]/page.tsx)           │
│ ┌─────────────────┐   ┌─────────────────────────┐  │
│ │ Results List    │   │ Leaflet Map            │  │
│ │ - Property cards│   │ - Interactive markers   │  │
│ │ - Pagination    │   │ - moveend handler       │  │
│ │ - Sorting       │   │ - bbox updates          │  │
│ └─────────────────┘   └─────────────────────────┘  │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│ URL State Hook (lib/search/url-state.ts)            │
│ - get(key): Get query param                         │
│ - setMany(updates, opts): Update multiple params    │
│ - Debounced updates: Smooth UX                      │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│ Search API (app/api/search/route.ts)                │
│ - Supabase queries with filters                     │
│ - Bbox filtering: lat/lng fallback                  │
│ - Category filtering: ID lookup                     │
│ - Sorting and pagination                            │
│ - Returns: { items, total, page, per }              │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│ Supabase Database                                   │
│ - properties table with lat/lng                     │
│ - categories table with slug                        │
│ - reviews table for avg_rating                      │
│ - Geo-spatial indexes (scripts/12-geo-indexes.sql)  │
└─────────────────────────────────────────────────────┘
```

## File Structure

### New Files Created

```
app/
├── api/
│   └── search/
│       └── route.ts              # Search API endpoint
├── k/
│   ├── [categories]/
│   │   ├── page.tsx              # Main search page
│   │   ├── loading.tsx           # Loading state
│   │   └── error.tsx             # Error boundary
│   └── all/
│       └── page.tsx              # Redirect to /k/

lib/
└── search/
    └── url-state.ts              # URL state management hook

scripts/
└── 12-geo-indexes.sql            # Database indexes

docs/
├── SETUP_GUIDE.md                # Updated with search docs
└── SEARCH_TESTING_GUIDE.md       # Comprehensive testing guide
```

### Modified Files

```
components/
└── category-bar.tsx              # Added navigation mode

app/
└── layout.tsx                    # Added Leaflet CSS
```

## Key Implementation Decisions

### 1. Category Filtering

**Decision:** Use category ID lookup instead of JOIN filtering

**Rationale:**
- Supabase PostgREST has limitations with filtering on joined tables
- Two-query approach ensures reliable filtering
- Minimal performance impact with indexed category lookups

**Implementation:**
```typescript
// Get category IDs from slugs
const { data: categoryData } = await supabase
  .from("categories")
  .select("id")
  .in("slug", categories)

// Filter properties by category IDs
query = query.in("category_id", categoryIds)
```

### 2. Bbox Updates

**Decision:** 300ms debounce on map moveend events

**Rationale:**
- Prevents excessive API calls during pan/zoom
- Balances responsiveness with performance
- Gives time for user to settle on desired view

**Implementation:**
```typescript
mapInstance.on("moveend", () => {
  if (moveTimeout) clearTimeout(moveTimeout)
  moveTimeout = setTimeout(() => {
    const newBbox = calculateBbox(mapInstance)
    urlState.setMany({ bbox: newBbox, page: 1 }, { debounce: true })
  }, 300)
})
```

### 3. URL State Hook

**Decision:** Custom hook instead of third-party library

**Rationale:**
- No new dependencies
- Simple, focused implementation
- Full control over debounce behavior
- Uses Next.js native APIs

**Features:**
- Debounced updates for smooth UX
- Automatic cleanup of empty values
- Type-safe with TypeScript
- Supports batch updates

### 4. Backward Compatibility

**Decision:** CategoryBar supports both navigation and callback modes

**Rationale:**
- Preserves existing home page behavior
- Enables new search page navigation
- No breaking changes to existing code

**Implementation:**
```typescript
interface CategoryBarProps {
  useNavigation?: boolean  // New prop for navigation mode
  onCategorySelect?: (slug: string | null) => void  // Optional for backward compatibility
}
```

### 5. Sorting Strategy

**Decision:** Whitelist approach with switch statement

**Rationale:**
- Security: Prevents SQL injection through sort parameter
- Clear: Explicit handling of each sort option
- Flexible: Easy to add new sort options

**Supported Sorts:**
- `relevance` (fallback: created_at DESC)
- `rating` (fallback: created_at DESC, TODO: use materialized view)
- `price_asc` (price_per_night ASC)
- `price_desc` (price_per_night DESC)
- `newest` (created_at DESC)

### 6. Leaflet Integration

**Decision:** Dynamic import with CDN CSS

**Rationale:**
- Reduces initial bundle size
- CDN CSS for reliability
- Matches existing property-map.tsx pattern

**Implementation:**
```typescript
// Dynamic import
const L = (await import("leaflet")).default

// CDN CSS in layout
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
```

## Database Schema Requirements

### Properties Table
```sql
CREATE TABLE properties (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  city TEXT NOT NULL,
  country TEXT NOT NULL,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  price_per_night DECIMAL(10, 2) NOT NULL,
  category_id UUID REFERENCES categories(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Categories Table
```sql
CREATE TABLE categories (
  id UUID PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL
);
```

### Indexes (scripts/12-geo-indexes.sql)
```sql
CREATE INDEX idx_properties_latitude ON properties(latitude);
CREATE INDEX idx_properties_longitude ON properties(longitude);
CREATE INDEX idx_properties_lat_lng ON properties(latitude, longitude);
CREATE INDEX idx_properties_is_active ON properties(is_active) WHERE is_active = true;
CREATE INDEX idx_properties_category_id ON properties(category_id);
CREATE INDEX idx_categories_slug ON categories(slug);
```

## Performance Considerations

### Database Queries
- **Indexes:** All query paths are indexed (lat, lng, category_id, is_active)
- **Pagination:** Uses `range()` for efficient pagination
- **Count:** Uses `{ count: "exact" }` for accurate totals
- **Joins:** Minimal joins, only for display data

### Client-Side
- **Debouncing:** Map updates and search input debounced
- **Dynamic Imports:** Leaflet loaded on-demand
- **React Optimization:** Uses Suspense for code splitting

### API Design
- **Stateless:** No server-side sessions or caching needed
- **RESTful:** Standard GET request with query parameters
- **Efficient:** Single query per request with all filters

## Testing Strategy

See `docs/SEARCH_TESTING_GUIDE.md` for comprehensive testing instructions.

### Key Test Scenarios
1. URL-driven state restoration
2. Map pan/zoom with bbox updates
3. Category filtering
4. Text search with debounce
5. Sorting and pagination
6. Deep linking and sharing
7. Error handling
8. Performance with large datasets

## Future Enhancements

### Short-term
1. ✅ Basic lat/lng bbox filtering (DONE)
2. ❌ True relevance sorting (requires pg_trgm)
3. ❌ Avg rating materialized view for rating sort
4. ❌ Better error messages and loading states

### Long-term
1. ❌ PostGIS integration for advanced geo queries
2. ❌ Distance sorting from user location
3. ❌ Polygon/shape searches (not just bbox)
4. ❌ Full-text search with pg_trgm
5. ❌ Faceted search (price ranges, amenities, etc.)
6. ❌ Search suggestions/autocomplete
7. ❌ Saved searches and alerts

## Security Audit Results

✅ **CodeQL Analysis:** 0 vulnerabilities found
✅ **Input Validation:** All user inputs validated and sanitized
✅ **SQL Injection:** Protected by Supabase parameterized queries
✅ **XSS:** React automatically escapes rendered content
✅ **CSRF:** Not applicable for GET requests
✅ **Authentication:** Uses Supabase RLS policies

## Deployment Checklist

- [ ] Run `scripts/12-geo-indexes.sql` in production database
- [ ] Verify Supabase environment variables are set
- [ ] Test deep linking in production environment
- [ ] Monitor API performance and optimize if needed
- [ ] Set up error tracking (Sentry, etc.)
- [ ] Add analytics for search behavior
- [ ] Create user documentation/help
- [ ] A/B test search UX improvements

## Maintenance Notes

### Common Tasks

**Add new sort option:**
1. Add case to switch in `app/api/search/route.ts`
2. Add option to Select in `app/k/[categories]/page.tsx`
3. Update documentation

**Add new filter:**
1. Update URL state interface
2. Add to API query building
3. Add UI control in search page
4. Update documentation

**Optimize performance:**
1. Check Supabase slow query logs
2. Add/optimize indexes as needed
3. Consider materialized views for complex aggregations
4. Monitor API response times

### Monitoring

Key metrics to track:
- API response time (p50, p95, p99)
- Search result counts (empty results rate)
- Map interaction patterns
- Most used filters and sorts
- Deep link usage
- Error rates

## Contributors

- Implementation: GitHub Copilot + damianGG
- Testing: [Your name]
- Code Review: [Reviewer name]

## References

- [Next.js App Router Documentation](https://nextjs.org/docs/app)
- [Supabase PostgREST API](https://postgrest.org/en/stable/api.html)
- [Leaflet Documentation](https://leafletjs.com/reference.html)
- [URL State Management Pattern](https://www.patterns.dev/posts/url-state-management)
