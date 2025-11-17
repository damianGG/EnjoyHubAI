# Categories and Subcategories with Image Support

## Overview
This implementation extends the category management system to support subcategories and image uploads for both categories and subcategories. Images are stored in Cloudinary for optimal performance and CDN delivery.

## Features

### 1. Enhanced Category Management
- **Image Support**: Each category can now have a custom image
- **Subcategories**: Create hierarchical category structures
- **Visual Interface**: New accordion-based UI for managing categories and their subcategories
- **Image Preview**: Real-time preview of uploaded images

### 2. Subcategory System
- **Parent-Child Relationship**: Each subcategory belongs to a parent category
- **Independent Images**: Subcategories can have their own images
- **Flexible Fields**: Optional icon and description for subcategories
- **Cascade Delete**: Deleting a category removes all its subcategories

### 3. Image Upload System
- **Cloudinary Integration**: All images are stored in Cloudinary
- **Organized Storage**: 
  - Categories: `categories/categories/`
  - Subcategories: `categories/subcategories/`
- **Validation**: File type and size validation (max 5MB)
- **Security**: Only super admins can upload category images

## Database Schema

### Categories Table (Enhanced)
```sql
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  icon TEXT NOT NULL,
  description TEXT,
  image_url TEXT,              -- NEW: Cloudinary image URL
  image_public_id TEXT,         -- NEW: Cloudinary public ID for deletion
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Subcategories Table (New)
```sql
CREATE TABLE subcategories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  icon TEXT,
  description TEXT,
  image_url TEXT,
  image_public_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(parent_category_id, slug)
);
```

### Properties Table (Enhanced)
```sql
ALTER TABLE properties 
ADD COLUMN subcategory_id UUID REFERENCES subcategories(id);
```

## API Endpoints

### Categories
- `GET /api/admin/categories` - List all categories
- `POST /api/admin/categories` - Create a new category
  - Body: `{ name, slug, icon, description?, image_url?, image_public_id? }`
- `PATCH /api/admin/categories` - Update a category
  - Body: `{ id, name?, slug?, icon?, description?, image_url?, image_public_id? }`
- `DELETE /api/admin/categories?id={id}` - Delete a category

### Subcategories
- `GET /api/admin/subcategories` - List all subcategories
- `GET /api/admin/subcategories?categoryId={id}` - List subcategories for a category
- `POST /api/admin/subcategories` - Create a new subcategory
  - Body: `{ parent_category_id, name, slug, icon?, description?, image_url?, image_public_id? }`
- `PATCH /api/admin/subcategories` - Update a subcategory
  - Body: `{ id, parent_category_id?, name?, slug?, icon?, description?, image_url?, image_public_id? }`
- `DELETE /api/admin/subcategories?id={id}` - Delete a subcategory

### Image Upload
- `POST /api/upload-category-image` - Upload category/subcategory image
  - Form Data:
    - `image`: File (JPEG, PNG, GIF, WebP)
    - `categoryType`: "category" | "subcategory"
  - Returns: `{ secure_url, public_id }`

## Type Definitions

### Category
```typescript
interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string;
  description?: string;
  image_url?: string;
  image_public_id?: string;
  created_at: string;
}
```

### Subcategory
```typescript
interface Subcategory {
  id: string;
  parent_category_id: string;
  name: string;
  slug: string;
  icon?: string;
  description?: string;
  image_url?: string;
  image_public_id?: string;
  created_at: string;
}
```

## Usage

### Admin Interface
1. Navigate to `/admin/categories`
2. Click "Add Category" to create a new category
3. Fill in the details and optionally upload an image
4. Expand a category to manage its subcategories
5. Click "Add Subcategory" within a category to create subcategories

### Image Upload
1. In the category/subcategory dialog, click "Upload Image"
2. Select an image file (PNG, JPG, GIF, WebP, max 5MB)
3. The image is automatically uploaded to Cloudinary
4. Preview appears immediately after upload
5. Click the X button to remove the image

## Security

### Authentication & Authorization
- All endpoints require super admin role
- Image uploads are restricted to super admins
- User verification through Supabase authentication

### Input Validation
- File type whitelist: JPEG, PNG, GIF, WebP only
- File size limit: 5MB maximum
- Required field validation on both client and server
- SQL injection protection through parameterized queries

### Data Protection
- Cloudinary credentials stored in environment variables
- Server-side image processing only
- Organized folder structure in Cloudinary
- Cascade delete to maintain referential integrity

## Migration

Run the migration script to add the new tables and columns:

```sql
-- Run scripts/14-add-subcategories-and-images.sql
psql -d your_database -f scripts/14-add-subcategories-and-images.sql
```

Or in Supabase:
1. Go to SQL Editor
2. Copy the content of `scripts/14-add-subcategories-and-images.sql`
3. Execute the script

## Environment Variables

Ensure these are set in your `.env.local`:

```bash
# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## UI Components

### CategoryManagementEnhanced
Main component for managing categories and subcategories:
- Accordion layout for collapsible category sections
- Image upload with preview
- Inline subcategory management
- Drag-and-drop style file input
- Toast notifications for user feedback

## Future Enhancements

Potential improvements:
1. Image transformation (thumbnails, cropping)
2. Bulk operations for categories
3. Category reordering with drag-and-drop
4. Image optimization settings
5. Alternative text for images (accessibility)
6. Category icons from icon libraries (not just emoji)
7. Category analytics and usage statistics
8. Import/export categories
9. Multi-language support for categories
10. Category templates

## Testing

### Manual Testing Checklist
- [ ] Create a new category with an image
- [ ] Create a new category without an image
- [ ] Update a category's image
- [ ] Remove a category's image
- [ ] Create a subcategory with an image
- [ ] Create a subcategory without an image
- [ ] Update a subcategory
- [ ] Delete a subcategory
- [ ] Delete a category with subcategories (cascade delete)
- [ ] Verify images display correctly
- [ ] Test file size limit (try uploading >5MB)
- [ ] Test file type validation (try uploading non-image)
- [ ] Test as non-admin user (should be denied)

## Troubleshooting

### Images not displaying
1. Check Cloudinary credentials in `.env.local`
2. Verify `res.cloudinary.com` is in `next.config.mjs` remotePatterns
3. Check browser console for CORS errors
4. Verify image URLs in database

### Upload fails
1. Check file size (<5MB)
2. Verify file type (JPEG, PNG, GIF, WebP)
3. Check Cloudinary quota
4. Verify super admin role
5. Check server logs for detailed errors

### Subcategories not showing
1. Verify database migration ran successfully
2. Check that subcategories table exists
3. Verify parent_category_id is correct
4. Check RLS policies in Supabase

## Implementation Notes

- Images are not required for categories/subcategories
- Icon (emoji) is still supported for backward compatibility
- Existing categories are not affected by the migration
- The old `category-management.tsx` component is preserved for reference
- The new component is used by default in `/admin/categories`
