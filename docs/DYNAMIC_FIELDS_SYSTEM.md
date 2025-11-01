# Dynamic Entertainment Objects Management System

This feature allows super admins to dynamically manage entertainment object categories and their associated fields, enabling hosts to create customized entertainment offerings.

## Features

### Super Admin Capabilities
- Create, edit, and delete entertainment categories (e.g., go-karts, paintball, inflatables)
- Define dynamic fields for each category with:
  - Field types: text, textarea, number, select, checkbox, file
  - Validation rules: min/max values, length constraints
  - Required/optional flags
  - Help text and placeholders
  - Custom options for select fields

### Host Capabilities
- Select a category when creating an entertainment object
- Fill out dynamically generated forms based on category-specific fields
- Upload files/images via Cloudinary integration
- Manage their own entertainment objects

### User Roles
- **super_admin**: Full access to manage categories, fields, and system configuration
- **host**: Can create and manage their own entertainment objects
- **user**: Regular users browsing the platform

## Database Schema

The system adds the following tables:

### `category_fields`
Stores dynamic field definitions for each category:
- `id`: UUID primary key
- `category_id`: Reference to categories table
- `field_name`: Internal field name (e.g., "minimum_age")
- `field_label`: Display label (e.g., "Minimum Age")
- `field_type`: Type of field (text, textarea, number, select, checkbox, file)
- `field_order`: Display order in the form
- `is_required`: Whether the field is mandatory
- `validation_rules`: JSON object with validation constraints
- `options`: Array of options for select fields
- `placeholder`: Placeholder text
- `help_text`: Additional help information

### `object_field_values`
Stores the actual values for dynamic fields per property:
- `id`: UUID primary key
- `property_id`: Reference to properties table
- `field_id`: Reference to category_fields table
- `value`: The field value (as text)
- `file_url`: URL for uploaded files (file type fields)

### Updated `users` table
- Added `role` enum field: 'user' | 'host' | 'super_admin'

## API Endpoints

### Super Admin APIs

#### Categories
- `GET /api/admin/categories` - List all categories
- `POST /api/admin/categories` - Create a new category
- `PATCH /api/admin/categories` - Update a category
- `DELETE /api/admin/categories?id={id}` - Delete a category

#### Fields
- `GET /api/admin/fields?category_id={id}` - List fields for a category
- `POST /api/admin/fields` - Create a new field
- `PATCH /api/admin/fields` - Update a field
- `DELETE /api/admin/fields?id={id}` - Delete a field

### Host APIs

#### Field Values
- `GET /api/properties/field-values?property_id={id}` - Get field values for a property
- `POST /api/properties/field-values` - Save/update field values for a property
- `DELETE /api/properties/field-values?id={id}&property_id={pid}` - Delete a field value

#### File Upload
- `POST /api/upload` - Upload files to Cloudinary

## Usage

### Setting up a Super Admin

To set a user as super admin, update the database:

```sql
UPDATE users 
SET role = 'super_admin' 
WHERE email = 'admin@example.com';
```

### Creating a New Category

1. Navigate to `/admin/categories`
2. Click "Add Category"
3. Fill in:
   - Name (e.g., "Go-Karts")
   - Slug (e.g., "go-karts")
   - Icon (emoji like 🏎️)
   - Description

### Adding Fields to a Category

1. Navigate to `/admin/fields`
2. Select a category from the dropdown
3. Click "Add Field"
4. Configure:
   - Field name (internal identifier)
   - Field label (displayed to users)
   - Field type (text, number, select, etc.)
   - Display order
   - Required flag
   - Validation rules (min/max, length, etc.)
   - Options (for select fields)
   - Placeholder and help text

### Creating an Entertainment Object (Host)

1. Navigate to `/host/properties/new`
2. Select a category
3. Fill in basic information (title, description, location)
4. Fill in category-specific dynamic fields
5. Add amenities and images
6. Submit

## Environment Variables

For Cloudinary file uploads:
```env
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=your_upload_preset
```

If not configured, the system will use placeholder URLs for uploaded files.

## Security

- All admin endpoints check for `super_admin` role
- Row Level Security (RLS) policies enforce:
  - Only super admins can modify category_fields
  - Only property owners can modify their object_field_values
  - Anyone can view categories and fields
  - Active properties' field values are publicly viewable
- File uploads require authentication
- Server-side validation for all dynamic fields

## Validation

### Client-side
- Required field checks
- Min/max value validation for numbers
- Length constraints for text fields
- Type validation

### Server-side
- API endpoints validate all inputs
- RLS policies enforce access control
- Field type validation
- Data type constraints

## Responsive Design

All interfaces are built with mobile-first principles using Tailwind CSS and shadcn/ui components, ensuring full responsiveness across devices.
