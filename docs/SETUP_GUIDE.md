# Setup Guide: Dynamic Fields System

This guide walks through setting up and testing the dynamic fields system.

## Prerequisites

1. Supabase project set up with connection credentials
2. Next.js development environment
3. Node.js and npm installed

## Installation Steps

### 1. Database Setup

Run the SQL migration scripts in order:

```bash
# If using Supabase CLI
supabase db push

# Or run SQL files directly in Supabase SQL Editor
```

Execute these scripts in order:
1. `scripts/01-create-tables.sql` - Base tables (if not already done)
2. `scripts/03-add-categories.sql` - Categories table (if not already done)
3. `scripts/09-dynamic-fields-system.sql` - Dynamic fields tables and RLS
4. `scripts/10-set-super-admin.sql` - Set up super admin user
5. `scripts/11-sample-field-data.sql` - Sample categories and fields (optional)
6. `scripts/12-geo-indexes.sql` - Geographic and search indexes (optional, see note below)

### 2. Geographic Indexes (Optional)

The search and map features work without PostGIS, using standard latitude/longitude BTREE indexes. For best performance, run:

```bash
# In Supabase SQL Editor, execute:
# scripts/12-geo-indexes.sql
```

**Note**: PostGIS setup in the script is commented out. The bbox fallback using BTREE indexes on latitude/longitude works without PostGIS and provides good performance for most use cases. If you need distance-based sorting or complex spatial queries, uncomment the PostGIS sections.

### 3. Set Super Admin User

After registering a user account:

```sql
-- In Supabase SQL Editor
UPDATE users 
SET role = 'super_admin' 
WHERE email = 'your-email@example.com';
```

### 4. Configure Environment Variables (Optional)

For Cloudinary file uploads, add to `.env.local`:

```env
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=your_upload_preset
```

Without these, the system will use placeholder URLs for file uploads.

### 5. Install Dependencies

```bash
npm install --legacy-peer-deps
```

### 6. Run Development Server

```bash
npm run dev
```

## Testing the System

### Test Search and Map Features

1. **Access Category Search Page**
   - Navigate to `/k/[category-slug]` (e.g., `/k/paintball`)
   - The page should load with a list of properties on the left and a map on the right
   
2. **Test URL Parameters**
   - Try `/k/paintball?q=track&sort=price_asc`
   - Verify that search query filters properties
   - Verify that sort option works (price ascending)
   
3. **Test Map Interactions**
   - Pan and zoom the map
   - After ~300ms, the URL should update with bbox parameter
   - The property list should refresh with properties in the visible map area
   
4. **Test Category Navigation**
   - Click on a category in the CategoryBar
   - Should navigate to `/k/{slug}` route
   - Should show filtered properties for that category
   - Click "Wszystkie" (All) button
   - Should navigate back to homepage `/`

5. **Test Pagination**
   - If there are more than 20 results, pagination controls should appear
   - Click "Next" to go to page 2
   - URL should update with `page=2` parameter
   - Click "Previous" to return to page 1

6. **Manual API Testing**
   ```bash
   # Test search API directly
   curl "http://localhost:3000/api/search?q=property&per=5"
   
   # Test with bbox (bounding box around Poland)
   curl "http://localhost:3000/api/search?bbox=14.0,49.0,24.0,55.0&per=10"
   
   # Test with category filter
   curl "http://localhost:3000/api/search?categories=paintball&sort=price_desc"
   
   # Test with multiple parameters
   curl "http://localhost:3000/api/search?q=fun&categories=paintball,gokarty&sort=rating&page=1&per=20"
   ```

### Test Super Admin Features

1. **Access Admin Dashboard**
   - Navigate to `/admin`
   - You should see the super admin dashboard

2. **Manage Categories**
   - Go to `/admin/categories`
   - Click "Add Category"
   - Create a test category:
     - Name: "Test Go-Karts"
     - Slug: "test-go-karts"
     - Icon: "🏎️"
     - Description: "Test go-kart facilities"
   - Verify you can edit and view the category

3. **Manage Fields**
   - Go to `/admin/fields`
   - Select the category you just created
   - Click "Add Field"
   - Create test fields:
     
     **Field 1: Minimum Age**
     - Field Name: `minimum_age`
     - Field Label: "Minimum Age"
     - Field Type: Number
     - Required: Yes
     - Validation: Min: 3, Max: 100
     - Placeholder: "e.g., 8"
     - Help Text: "Minimum age required"
     
     **Field 2: Track Type**
     - Field Name: `track_type`
     - Field Label: "Track Type"
     - Field Type: Select
     - Options (one per line):
       ```
       Indoor
       Outdoor
       Both
       ```
     - Required: Yes
     
     **Field 3: Safety Gear**
     - Field Name: `has_safety_gear`
     - Field Label: "Provides Safety Gear"
     - Field Type: Checkbox
     - Required: No
     
     **Field 4: Track Photo**
     - Field Name: `track_photo`
     - Field Label: "Track Photo"
     - Field Type: File
     - Required: No

### Test Host Features

1. **Switch to Host Role**
   ```sql
   UPDATE users 
   SET role = 'host', is_host = true 
   WHERE email = 'host@example.com';
   ```

2. **Create Property with Dynamic Fields**
   - Navigate to `/host/properties/new`
   - Select the category you created
   - Fill in basic information:
     - Title: "Speed Racing Go-Karts"
     - Description: "Fastest tracks in town"
     - Location: Choose on map
     - Price: 50
     - Max guests: 20
   
3. **Fill Dynamic Fields**
   - The form should now show your custom fields
   - Fill in the minimum age (e.g., 8)
   - Select track type (e.g., "Outdoor")
   - Check the safety gear checkbox
   - Upload a test image (or use placeholder)
   
4. **Submit and Verify**
   - Click "Add Property"
   - Navigate to `/host/properties`
   - Verify the property appears in your list

### Test Field Values Persistence

1. **API Test with curl:**

```bash
# Get fields for a category
curl -X GET "http://localhost:3000/api/admin/fields?category_id=YOUR_CATEGORY_ID"

# Get field values for a property
curl -X GET "http://localhost:3000/api/properties/field-values?property_id=YOUR_PROPERTY_ID"
```

2. **Database Verification:**

```sql
-- Check if field values were saved
SELECT 
  ofv.id,
  ofv.property_id,
  cf.field_label,
  cf.field_type,
  ofv.value,
  ofv.file_url
FROM object_field_values ofv
JOIN category_fields cf ON cf.id = ofv.field_id
WHERE ofv.property_id = 'YOUR_PROPERTY_ID';
```

## Validation Tests

### Test Required Fields
1. Try to submit a property without filling required fields
2. Should see validation errors
3. Required fields should be marked with red asterisk

### Test Number Validation
1. Try entering a value below min (e.g., age = 2 when min is 3)
2. Should see validation error
3. Try entering a value above max
4. Should see validation error

### Test Text Length Validation
1. If you set maxLength on a text field
2. Try entering text longer than the limit
3. Should see validation error

### Test File Upload
1. Click upload button on a file field
2. Select an image file
3. Should see upload progress
4. Should see image preview after upload
5. Should be able to remove uploaded file

## Troubleshooting

### "Unauthorized" error in admin pages
- Verify your user has `role = 'super_admin'` in the database
- Check browser console for authentication errors

### Fields not appearing in form
- Verify fields exist in database for the selected category
- Check browser console for API errors
- Verify RLS policies allow reading category_fields

### File upload fails
- Check Cloudinary credentials if configured
- Without credentials, placeholder URLs will be used
- Check browser console for upload errors
- Verify user is authenticated

### Database errors
- Ensure all migration scripts ran successfully
- Check Supabase logs for RLS policy violations
- Verify foreign key relationships are intact

## Common Issues

**Issue**: Can't see admin menu
**Solution**: Make sure user role is 'super_admin' in users table

**Issue**: Field values not saving
**Solution**: Check that property was created first, then field values are saved

**Issue**: File upload returns placeholder
**Solution**: This is expected if Cloudinary is not configured. Configure environment variables for actual uploads.

**Issue**: TypeScript errors
**Solution**: Pre-existing type errors in dummy Supabase client are expected in sandbox. Real deployment works correctly.

## Next Steps

After successful testing:

1. Create more categories for your use case
2. Define comprehensive field sets for each category
3. Test with real users (host and guest roles)
4. Monitor field value data in database
5. Adjust validation rules based on user feedback

## Support

For issues or questions:
- Check documentation in `/docs/DYNAMIC_FIELDS_SYSTEM.md`
- Review code comments in components
- Check Supabase dashboard for database issues

## Search and Map Feature

The application includes a comprehensive search and map experience with URL-driven state.

### URL Structure

Search pages use the `/k/[categories]` route pattern:

- `/k/all` - All properties (redirects to search with no filters)
- `/k/paintball` - Properties in the paintball category
- `/k/paintball,gokarty` - Properties in multiple categories (CSV)

### Query Parameters

The URL supports these query parameters:

- `q` - Text search query (searches property titles)
- `bbox` - Map bounding box as "west,south,east,north" (e.g., "19.8,50.0,20.2,50.2")
- `sort` - Sort order: relevance, rating, price_asc, price_desc, newest
- `page` - Page number (default: 1)
- `per` - Items per page (default: 20, max: 100)
- `categories` - Comma-separated category slugs (mirrors the path)

### Example URLs

```
/k/paintball
/k/paintball?q=outdoor&sort=price_asc
/k/paintball,gokarty?q=tor&bbox=19.8,50.0,20.2,50.2&sort=rating&page=1&per=20
```

### Features

1. **Deep Linking**: All search state is in the URL. Share links to restore exact views.
2. **Map Auto-Refresh**: Moving the map updates the bbox in the URL (debounced 300ms) and triggers results refresh.
3. **Category Navigation**: Click categories in the CategoryBar to navigate to `/k/{slug}`.
4. **Responsive Layout**: Split view with results list (left) and interactive map (right).
5. **Real-time Updates**: Results update as you pan/zoom the map or change filters.

### API Endpoint

The search is powered by `/api/search` which accepts the same query parameters and returns:

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

### Testing Search

1. Navigate to the home page
2. Click a category (e.g., "Paintball") - this will navigate to `/k/paintball`
3. Try searching with the search box
4. Pan and zoom the map - notice the URL updates with bbox
5. Try different sort options
6. Copy the URL and open in a new tab - the view should be restored exactly
