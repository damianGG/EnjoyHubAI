# Search and Map Feature - Testing Guide

## Overview

This document provides comprehensive testing instructions for the new search and map experience implemented at `/k/[categories]`.

## Prerequisites

1. Supabase database set up with:
   - Properties with `latitude` and `longitude` values
   - Categories with `slug` values
   - Active properties (`is_active = true`)
   
2. Run the geo-spatial indexes script:
   ```sql
   -- In Supabase SQL Editor, run:
   -- scripts/12-geo-indexes.sql
   ```

3. Application running locally:
   ```bash
   npm install --legacy-peer-deps
   npm run dev
   ```

## Test Scenarios

### 1. Basic Navigation

**Test 1.1: Navigate from Home to Category Search**
- Start at home page (`/`)
- Click on a category in the CategoryBar (e.g., "Paintball")
- Expected: Browser navigates to `/k/paintball`
- Expected: Results list shows properties in the paintball category
- Expected: Map shows markers for visible properties

**Test 1.2: "All Categories" Navigation**
- From any search page, click "All Categories" (Wszystkie) button
- Expected: Browser navigates to `/k/all`
- Expected: All properties are shown (no category filter)

**Test 1.3: Direct URL Access**
- Open browser and navigate directly to `/k/gokarty`
- Expected: Page loads showing only gokarty properties
- Expected: URL remains `/k/gokarty`

### 2. Search Functionality

**Test 2.1: Text Search**
- Navigate to `/k/paintball`
- Type "outdoor" in the search box
- Wait 500ms for debounce
- Expected: URL updates to `/k/paintball?q=outdoor`
- Expected: Results list updates to show only properties with "outdoor" in title
- Expected: Map markers update accordingly

**Test 2.2: Clear Search**
- From a search with query (e.g., `?q=test`)
- Clear the search box
- Expected: URL updates to remove `q` parameter
- Expected: All properties in the category are shown again

### 3. Map Interactions

**Test 3.1: Map Pan**
- Navigate to `/k/paintball`
- Pan the map to a different location
- Wait 300ms for debounce
- Expected: URL updates with `bbox` parameter (e.g., `?bbox=19.5,50.0,20.0,50.5`)
- Expected: Results list updates to show only properties in the visible map area
- Expected: Total count updates accordingly

**Test 3.2: Map Zoom**
- Navigate to `/k/gokarty`
- Zoom in to a smaller area
- Wait 300ms
- Expected: URL updates with new bbox values
- Expected: Results list filters to properties in the zoomed area

**Test 3.3: Initial Bbox from URL**
- Navigate to `/k/paintball?bbox=19.0,50.0,20.0,51.0`
- Expected: Map fits to the specified bounding box on load
- Expected: Results show properties within that bbox

### 4. Sorting

**Test 4.1: Sort by Price (Low to High)**
- Navigate to `/k/paintball`
- Select "Price: Low to High" from sort dropdown
- Expected: URL updates to `?sort=price_asc`
- Expected: Results are sorted by price_per_night ascending
- Expected: Cheapest property appears first

**Test 4.2: Sort by Price (High to Low)**
- Select "Price: High to Low"
- Expected: URL updates to `?sort=price_desc`
- Expected: Most expensive property appears first

**Test 4.3: Sort by Newest**
- Select "Newest"
- Expected: URL updates to `?sort=newest`
- Expected: Most recently created properties appear first

### 5. Pagination

**Test 5.1: Navigate to Next Page**
- Navigate to `/k/paintball`
- If more than 20 results, click "Next" button
- Expected: URL updates to `?page=2`
- Expected: Results list shows items 21-40
- Expected: "Previous" button becomes enabled

**Test 5.2: Pagination Resets on Filter Change**
- On page 2 (`?page=2`)
- Change the search query or pan the map
- Expected: URL resets to `?page=1` with new filters
- Expected: First page of filtered results is shown

### 6. Combined Filters

**Test 6.1: Multiple Filters**
- Navigate to `/k/paintball,gokarty?q=outdoor&sort=price_asc&page=1&per=10`
- Expected: Shows properties from both categories
- Expected: Filtered by "outdoor" in title
- Expected: Sorted by price ascending
- Expected: 10 items per page

**Test 6.2: URL as Source of Truth**
- Apply multiple filters (search, sort, bbox, pagination)
- Copy the URL
- Open the URL in a new browser tab or private window
- Expected: Exact same view is restored (all filters, map position, page)

### 7. Multiple Categories

**Test 7.1: Multiple Category Navigation**
- Navigate to `/k/paintball,gokarty`
- Expected: Properties from both paintball AND gokarty categories are shown
- Expected: Map shows markers from both categories

**Test 7.2: Category Parameter Sync**
- Navigate to `/k/trampoliny`
- Expected: URL includes `?categories=trampoliny` parameter
- Expected: Both path and query param represent the same state

### 8. Error Handling

**Test 8.1: Invalid Category**
- Navigate to `/k/nonexistent-category`
- Expected: Page loads (no errors)
- Expected: Empty results with message "No properties found"

**Test 8.2: Invalid Bbox**
- Navigate to `/k/paintball?bbox=invalid`
- Expected: bbox is ignored, map shows default view
- Expected: No errors in console

**Test 8.3: Invalid Page Number**
- Navigate to `/k/paintball?page=-5`
- Expected: Page defaults to 1
- Expected: First page of results is shown

### 9. Responsive Design

**Test 9.1: Mobile View**
- Resize browser to mobile width (<768px)
- Navigate to `/k/paintball`
- Expected: Layout adjusts appropriately
- Expected: Map and results are both accessible
- Expected: All functionality works on mobile

### 10. Performance

**Test 10.1: Large Result Set**
- Navigate to `/k/all` (all properties)
- Expected: Page loads within 2 seconds
- Expected: Map renders smoothly with all markers

**Test 10.2: Rapid Filter Changes**
- Quickly change sort, search, and pan map multiple times
- Expected: Debouncing prevents excessive API calls
- Expected: Only final state triggers API request
- Expected: UI remains responsive

### 11. Deep Linking

**Test 11.1: Share URL**
- Apply filters: search, category, bbox, sort
- Copy URL
- Share with another user (or open in incognito)
- Expected: Recipient sees exact same view

**Test 11.2: Bookmark**
- Set up a specific search view
- Bookmark the URL
- Close browser and reopen bookmark
- Expected: Exact view is restored

## API Testing

### Test API Endpoint Directly

```bash
# Test basic search
curl "http://localhost:3000/api/search?page=1&per=20"

# Test category filter
curl "http://localhost:3000/api/search?categories=paintball"

# Test bbox filter
curl "http://localhost:3000/api/search?bbox=19.0,50.0,20.0,51.0"

# Test text search
curl "http://localhost:3000/api/search?q=outdoor"

# Test sorting
curl "http://localhost:3000/api/search?sort=price_asc"

# Test combined filters
curl "http://localhost:3000/api/search?categories=paintball,gokarty&q=outdoor&bbox=19.0,50.0,20.0,51.0&sort=price_desc&page=1&per=10"
```

Expected response format:
```json
{
  "items": [
    {
      "id": "uuid",
      "title": "Property Name",
      "city": "City",
      "country": "Country",
      "latitude": 50.0,
      "longitude": 19.0,
      "price_per_night": 100,
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

## Known Limitations

1. **Rating Sort**: Currently falls back to created_at ordering. Will be improved with materialized view in future.
2. **PostGIS**: Geo-spatial indexes use lat/lng fallback. PostGIS support can be enabled for advanced features.
3. **Text Search**: Basic ILIKE on title. Can be improved with pg_trgm for fuzzy search.
4. **Distance Sort**: Not yet implemented. Requires PostGIS extension.

## Reporting Issues

When reporting issues, please include:
1. URL that reproduces the issue
2. Expected behavior
3. Actual behavior
4. Browser and version
5. Console errors (if any)
6. Network tab showing API requests/responses

## Success Criteria

All tests should pass with:
- ✅ No console errors
- ✅ Smooth map interactions
- ✅ Accurate result filtering
- ✅ URL updates correctly
- ✅ Deep links work
- ✅ Responsive on all screen sizes
- ✅ No security vulnerabilities
- ✅ API returns correct data
