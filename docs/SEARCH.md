# Search Feature Documentation

## Overview

This document describes the URL-driven search feature with dynamic map-bounds filtering for the EnjoyHubAI application. The feature provides a shareable, SSR-first search experience with Leaflet maps and Supabase backend (no PostGIS).

## Architecture

### Tech Stack
- **Frontend**: Next.js 15 (App Router, SSR-first)
- **Backend**: Supabase (PostgreSQL with cube/earthdistance extensions)
- **Map**: Leaflet with OpenStreetMap tiles
- **State Management**: URL as single source of truth

### URL Parameters

All search state is stored in URL query parameters:

- `q` - Text search query
- `categories` - Category filter (repeatable)
- `bbox` - Map bounds: `minLng,minLat,maxLng,maxLat`
- `center` - Map center: `lat,lng`
- `zoom` - Map zoom level (number)
- `sort` - Sort order: `distance` | `rating` | `popular`
- `page` - Pagination page number
- `af` - Attribute filters (repeatable): `key:value`

Example URL:
```
/search?q=paintball&categories=paintball&bbox=20.5,52.2,20.6,52.3&center=52.324,20.592&zoom=12&sort=rating&af=parking:free&af=outdoor:true
```

## Database Schema

### Extensions

```sql
-- Lightweight extensions (no PostGIS)
create extension if not exists cube;
create extension if not exists earthdistance;
create extension if not exists pg_trgm;
create extension if not exists unaccent;
```

### Tables

#### `places`
Main table storing searchable locations:

```sql
create table public.places (
  id bigserial primary key,
  name text not null,
  description text,
  category_slug text not null,
  city text,
  region text,
  lat double precision not null,
  lng double precision not null,
  has_online_booking boolean default false,
  open_hours jsonb,
  price_min numeric,
  price_max numeric,
  rating numeric,
  reviews_count int default 0,
  attributes jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
```

**Indexes:**
- `places_category_idx` - Category filtering
- `places_lat_idx`, `places_lng_idx`, `places_lat_lng_idx` - Bounding box queries
- `places_earth_gist` - Distance calculations (earthdistance)
- `places_name_trgm`, `places_desc_trgm` - Full-text search (pg_trgm)
- `places_attributes_gin` - JSONB attribute filtering

#### `attribute_definitions`
Admin-driven dynamic filter definitions:

```sql
create table public.attribute_definitions (
  id bigserial primary key,
  key text not null,
  label text not null,
  type text not null, -- 'boolean' | 'enum' | 'number' | 'range' | 'string'
  category_slug text,
  options jsonb,
  active boolean default true,
  sort_order int default 100
);
```

### RPC Function

#### `search_places_simple`

Main search function that handles:
- Bounding box filtering
- Category filtering
- Text search (with unaccent)
- Dynamic attribute filtering (JSONB)
- Distance calculation (earthdistance)
- Sorting by distance, rating, or popularity

**Parameters:**
```typescript
{
  p_bbox: string | null,           // "minLng,minLat,maxLng,maxLat"
  p_categories: string[] | null,
  p_q: string | null,
  p_sort: 'distance' | 'rating' | 'popular',
  p_center_lat: number | null,
  p_center_lng: number | null,
  p_attr: jsonb | null,            // {"parking":"free","outdoor":true}
  p_limit: number,
  p_offset: number
}
```

**Returns:**
```typescript
{
  id: number,
  name: string,
  category_slug: string,
  lat: number,
  lng: number,
  rating: number,
  distance_m: number
}[]
```

## API Routes

### `GET /api/search`

Proxies to Supabase RPC `search_places_simple`.

**Query Parameters:** All URL search params (q, categories, bbox, center, zoom, sort, page, af)

**Response:**
```json
{
  "results": [
    {
      "id": 1,
      "name": "Paintball Kampinos",
      "category_slug": "paintball",
      "lat": 52.324,
      "lng": 20.592,
      "rating": 4.5,
      "distance_m": 5234.56
    }
  ],
  "page": 1,
  "limit": 30
}
```

### `GET /api/attributes`

Fetches active attribute definitions for dynamic filters.

**Query Parameters:**
- `category` (optional) - Filter by category

**Response:**
```json
{
  "attributes": [
    {
      "id": 1,
      "key": "parking",
      "label": "Parking",
      "type": "enum",
      "category_slug": null,
      "options": ["free", "paid", "none"],
      "active": true,
      "sort_order": 10
    }
  ]
}
```

## Components

### `app/search/page.tsx`
SSR page that:
1. Parses URL search params
2. Fetches initial results via Supabase RPC
3. Renders filters, results list, and map

### `components/SearchFilters.tsx`
Dynamic filters UI:
- Text search input
- Category toggles
- Sort dropdown
- Dynamic attribute filters (fetched from `/api/attributes`)

All changes update URL and trigger refetch.

### `components/SearchResultsClient.tsx`
Client component that:
- Displays list of places
- Refetches results when URL changes
- Shows loading and empty states

### `components/MapWithSearch.tsx`
Leaflet map component:
- Renders markers for places
- Updates URL (bbox, center, zoom) on map move (moveend event)
- Syncs with URL state on mount

## Utilities

### `lib/urlSearch.ts`

Helper functions for URL state management:

```typescript
// Parse URL search params into typed object
parseSearchParams(searchParams: URLSearchParams): SearchParams

// Build URLSearchParams from SearchParams object
buildSearchParams(params: SearchParams): URLSearchParams

// Update specific params while preserving others
updateSearchParams(current: SearchParams, updates: Partial<SearchParams>): SearchParams

// Convert attribute filters to JSONB for Supabase
attributeFiltersToJsonb(af?: Record<string, string>): Record<string, any> | null
```

## Setup Instructions

### 1. Install Dependencies

```bash
npm install --legacy-peer-deps
```

Dependencies include:
- `leaflet` ^1.9.4
- `@types/leaflet` (dev dependency)
- `@supabase/ssr`

### 2. Run Migrations

Apply migrations in order:

```bash
# In Supabase Dashboard or via CLI
# 1. Extensions and schema
supabase/migrations/20251103_search_baseline.sql

# 2. RPC function
supabase/migrations/20251103_rpc_search.sql

# 3. Seed data
supabase/migrations/20251103_seed_sample_data.sql
```

Or via Supabase CLI:
```bash
supabase db push
```

### 3. Configure Environment

Ensure these environment variables are set:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

### 4. Build and Run

```bash
npm run build
npm run dev
```

Visit http://localhost:3000/search

## Usage Examples

### Basic Search
```
/search?q=paintball
```

### Category Filter
```
/search?categories=paintball&categories=gokarty
```

### Map Bounds Filter
```
/search?bbox=20.5,52.2,20.6,52.3&center=52.25,20.55&zoom=12
```

### Dynamic Attribute Filters
```
/search?af=parking:free&af=outdoor:true&af=kids_min:10
```

### Combined
```
/search?q=warszawa&categories=paintball&bbox=20.5,52.2,20.6,52.3&center=52.324,20.592&zoom=12&sort=rating&af=parking:free
```

## Development Tips

### Adding New Attributes

1. Insert into `attribute_definitions`:
```sql
INSERT INTO public.attribute_definitions (key, label, type, category_slug, options, active, sort_order)
VALUES ('has_wifi', 'Wi-Fi dostępne', 'boolean', null, null, true, 60);
```

2. Update places with the attribute:
```sql
UPDATE public.places
SET attributes = attributes || '{"has_wifi": true}'::jsonb
WHERE id = 1;
```

3. Filters will automatically appear in UI

### Adding New Categories

Update the `CATEGORIES` array in `app/search/page.tsx`:
```typescript
const CATEGORIES = [
  { slug: 'paintball', label: 'Paintball' },
  { slug: 'gokarty', label: 'Gokarty' },
  { slug: 'escape-room', label: 'Escape Room' },
  { slug: 'new-category', label: 'New Category' }, // Add here
]
```

### Debugging

Enable Supabase query logging:
```typescript
const { data, error } = await supabase.rpc('search_places_simple', params)
console.log('Query result:', { data, error })
```

Check browser console for client-side errors.

## Performance Considerations

- **Indexes**: All key columns have appropriate indexes (see schema)
- **Pagination**: Results limited to 30 per page by default
- **Map bounds**: Only queries visible area after map movement
- **Debouncing**: Leaflet's `moveend` event naturally debounces during pan/zoom
- **SSR**: Initial render happens server-side for SEO and fast FCP

## Future Enhancements

- [ ] Add infinite scroll for results list
- [ ] Implement map clustering for many markers
- [ ] Add more attribute types (range, multi-select)
- [ ] Cache attribute definitions
- [ ] Add full-text search ranking
- [ ] Implement geolocation-based "near me" search
- [ ] Add URL-based result highlighting on map

## Troubleshooting

### Leaflet CSS not loading
Ensure `import 'leaflet/dist/leaflet.css'` is in `app/layout.tsx`.

### Map not rendering
Check browser console for errors. Ensure dynamic import is working:
```typescript
import('leaflet').then((L) => { ... })
```

### RPC function errors
Check Supabase logs. Ensure extensions are installed:
```sql
SELECT * FROM pg_extension WHERE extname IN ('cube', 'earthdistance', 'pg_trgm', 'unaccent');
```

### No results
- Check if seed data was inserted
- Verify RLS policies allow public read
- Check bbox coordinates are valid (lng, lat order)

## License

Same as parent project.
