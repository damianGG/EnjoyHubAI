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
6. `scripts/12-geo-indexes.sql` - Geo-spatial indexes for search optimization (optional but recommended)

### 1.1. Geo-spatial Indexes (Optional but Recommended)

The `scripts/12-geo-indexes.sql` script adds indexes for efficient location-based searches and bbox queries. This script:

- Creates indexes on `latitude` and `longitude` columns for fast bbox filtering
- Adds composite indexes for common query patterns
- Includes optional PostGIS support (commented out by default)
- Optimizes category filtering and text search

**To apply:**
```bash
# In Supabase SQL Editor
-- Run the contents of scripts/12-geo-indexes.sql
```

**Note:** PostGIS extension is optional. The fallback uses standard latitude/longitude numeric filtering which works well for most use cases. If you need advanced geo-spatial features in the future, uncomment the PostGIS-related lines in the script.

### 2. Set Super Admin User

After registering a user account:

```sql
-- In Supabase SQL Editor
UPDATE users 
SET role = 'super_admin' 
WHERE email = 'your-email@example.com';
```

### 3. Configure Environment Variables (Optional)

For Cloudinary file uploads, add to `.env.local`:

```env
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=your_upload_preset
```

Without these, the system will use placeholder URLs for file uploads.

### 4. Install Dependencies

```bash
npm install --legacy-peer-deps
```

### 5. Run Development Server

```bash
npm run dev
```

## Testing the System

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
