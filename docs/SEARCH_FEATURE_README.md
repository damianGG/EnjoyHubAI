# Search and Map Feature

## Quick Start

This feature provides a comprehensive search and map experience where the URL is the single source of truth for all search state.

### Basic Usage

Navigate to any category to start searching:
```
/k/paintball          → Search paintball properties
/k/gokarty            → Search go-kart properties  
/k/paintball,gokarty  → Search multiple categories
/k/all                → Search all properties
```

### URL Parameters

Add query parameters to refine your search:
```
?q=outdoor           → Text search in property titles
?bbox=w,s,e,n        → Bounding box for map area
?sort=price_asc      → Sort by price (low to high)
?page=2              → Pagination
?per=20              → Items per page
```

### Complete Example

```
/k/paintball,gokarty?q=outdoor&bbox=19.8,50.0,20.2,50.2&sort=rating&page=1&per=20
```

This URL searches for paintball and go-kart properties with "outdoor" in the title, within the specified map bounds, sorted by rating, showing page 1 with 20 items per page.

## Features

### 1. Deep Linking
Share URLs with colleagues or bookmark searches. The URL contains all state needed to restore the exact view.

### 2. Map Integration
- Interactive Leaflet map with custom markers
- Pan and zoom automatically update results
- Bbox parameter updates with 300ms debounce
- Click markers to see property details

### 3. Category Filtering
- Categories in URL path for SEO
- Support for multiple categories
- Efficient database queries with indexes

### 4. Search and Sort
- Text search in property titles
- Sort by: relevance, rating, price, newest
- Real-time updates as you type (debounced)

### 5. Pagination
- Full pagination support
- Accurate total counts
- Page resets on filter changes

## API Endpoint

The search is powered by `/api/search`:

```bash
GET /api/search?categories=paintball&q=outdoor&bbox=19.0,50.0,20.0,51.0&sort=price_asc&page=1&per=20
```

**Response:**
```json
{
  "items": [
    {
      "id": "uuid",
      "title": "Outdoor Paintball Arena",
      "city": "Warsaw",
      "country": "Poland",
      "latitude": 52.2297,
      "longitude": 21.0122,
      "price_per_night": 50,
      "category_slug": "paintball",
      "category_name": "Paintball",
      "avg_rating": 4.5
    }
  ],
  "total": 42,
  "page": 1,
  "per": 20
}
```

## Database Setup

Run the geo-spatial indexes script for optimal performance:

```sql
-- In Supabase SQL Editor, run:
-- scripts/12-geo-indexes.sql
```

This creates indexes on:
- `latitude` and `longitude` for bbox queries
- `category_id` for category filtering
- `is_active` for active property filtering
- `categories.slug` for fast lookups

## Implementation Details

### URL State Management

The `useUrlState()` hook provides a clean API for managing URL parameters:

```typescript
import { useUrlState } from "@/lib/search/url-state"

const urlState = useUrlState()

// Get a parameter
const query = urlState.get("q")

// Set a parameter
urlState.set("q", "outdoor")

// Set multiple parameters with debounce
urlState.setMany(
  { q: "outdoor", sort: "price_asc", page: 1 },
  { debounce: true, debounceMs: 300 }
)
```

### Map Integration

The search page uses Leaflet for interactive mapping:

```typescript
// Listen to map movements
mapInstance.on("moveend", () => {
  const bounds = mapInstance.getBounds()
  const bbox = `${sw.lng},${sw.lat},${ne.lng},${ne.lat}`
  urlState.setMany({ bbox, page: 1 }, { debounce: true })
})
```

### Category Navigation

The CategoryBar component supports navigation mode:

```tsx
<CategoryBar 
  useNavigation={true}
  selectedCategory={currentCategory}
/>
```

When `useNavigation` is true, clicking a category navigates to `/k/{slug}` instead of updating local state.

## Testing

See `docs/SEARCH_TESTING_GUIDE.md` for comprehensive testing instructions.

### Quick Test

1. Start the dev server: `npm run dev`
2. Navigate to http://localhost:3000
3. Click a category (e.g., "Paintball")
4. Search, pan the map, change sort options
5. Copy the URL and open in a new tab
6. Verify the exact view is restored

### API Test

```bash
curl "http://localhost:3000/api/search?categories=paintball&q=outdoor&sort=price_asc"
```

## Performance

- **Database:** Optimized with indexes on all query paths
- **API:** Single query per request with efficient pagination
- **Client:** Debounced updates prevent excessive re-renders
- **Map:** Dynamic Leaflet import reduces initial bundle size

## Security

✅ Passed CodeQL security scan (0 vulnerabilities)
- All inputs validated and sanitized
- SQL injection protected by Supabase parameterized queries
- XSS protected by React's auto-escaping
- Whitelist approach for sort parameter

## Documentation

- **Setup:** `docs/SETUP_GUIDE.md`
- **Testing:** `docs/SEARCH_TESTING_GUIDE.md`
- **Implementation:** `docs/SEARCH_IMPLEMENTATION_SUMMARY.md`

## Architecture

```
User Browser
     │
     ├─► URL State (query params)
     │        │
     │        ├─► Search Page Component
     │        │        │
     │        │        ├─► Results List
     │        │        │
     │        │        └─► Leaflet Map
     │        │
     │        └─► URL State Hook
     │                 │
     │                 └─► Next.js Router
     │
     └─► API Request (/api/search)
              │
              ├─► Input Validation
              │
              ├─► Supabase Query Builder
              │        │
              │        ├─► Category Filter
              │        ├─► Bbox Filter
              │        ├─► Text Search
              │        ├─► Sorting
              │        └─► Pagination
              │
              └─► Response with Items + Total
```

## Future Enhancements

### Planned
- PostGIS integration for advanced geo queries
- Distance sorting from user location
- Full-text search with pg_trgm
- Avg rating materialized view
- Faceted search (price ranges, amenities)

### Possible
- Search suggestions/autocomplete
- Saved searches and alerts
- Custom polygon/shape searches
- Multi-language search support
- Property comparison feature

## Troubleshooting

### Map not showing
- Check that Leaflet CSS is loaded in `app/layout.tsx`
- Verify properties have valid `latitude` and `longitude` values
- Check browser console for errors

### No results found
- Verify properties exist in the database
- Check that `is_active = true` for properties
- Ensure category slugs match database values
- Verify bbox covers the property locations

### URL not updating
- Check that the URL state hook is being called correctly
- Verify Next.js router is working (check browser history)
- Look for JavaScript errors in console

### Slow performance
- Run the geo-spatial indexes script
- Check Supabase logs for slow queries
- Monitor API response times
- Consider adding more specific indexes

## Support

For issues or questions:
1. Check the documentation files in `docs/`
2. Review the implementation summary
3. Test the API endpoint directly with curl
4. Check Supabase dashboard for database issues
5. Open an issue on GitHub with reproduction steps

## License

Same as the main project.

## Credits

Implemented with GitHub Copilot and Next.js 15 App Router.
