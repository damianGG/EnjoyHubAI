# Category Structure Diagram

## Database Schema

```
┌─────────────────────────────────────────────────┐
│              CATEGORIES TABLE                    │
├─────────────────────────────────────────────────┤
│ id (UUID, PK)                                   │
│ name (TEXT, UNIQUE, NOT NULL)                   │
│ slug (TEXT, UNIQUE, NOT NULL)                   │
│ icon (TEXT, NOT NULL)                           │
│ description (TEXT)                              │
│ image_url (TEXT) ◄─────────┐                   │
│ image_public_id (TEXT)      │                   │
│ created_at (TIMESTAMP)      │                   │
└─────────────────────────────┼───────────────────┘
                              │
                              │ Cloudinary
                              │ Integration
                              │
┌─────────────────────────────┼───────────────────┐
│           SUBCATEGORIES TABLE                    │
├─────────────────────────────┼───────────────────┤
│ id (UUID, PK)               │                   │
│ parent_category_id (UUID, FK) ──► categories.id│
│ name (TEXT, NOT NULL)       │                   │
│ slug (TEXT, NOT NULL)       │                   │
│ icon (TEXT)                 │                   │
│ description (TEXT)          │                   │
│ image_url (TEXT) ◄──────────┘                   │
│ image_public_id (TEXT)                          │
│ created_at (TIMESTAMP)                          │
│ UNIQUE(parent_category_id, slug)                │
└─────────────────────────────────────────────────┘
          │
          │ References
          ▼
┌─────────────────────────────────────────────────┐
│              PROPERTIES TABLE                    │
├─────────────────────────────────────────────────┤
│ id (UUID, PK)                                   │
│ category_id (UUID, FK) ──► categories.id       │
│ subcategory_id (UUID, FK) ──► subcategories.id │
│ ... other fields ...                            │
└─────────────────────────────────────────────────┘
```

## Hierarchy Example

```
Categories (with images)
│
├─ 🏎️ Go-Karts [Image: go-kart-track.jpg]
│   │
│   ├─ 🏁 Indoor Karting [Image: indoor-track.jpg]
│   ├─ 🌳 Outdoor Karting [Image: outdoor-track.jpg]
│   └─ ⚡ Electric Karts [Image: electric-kart.jpg]
│
├─ 🎈 Dmuchańce [Image: inflatables.jpg]
│   │
│   ├─ 🏰 Zamki dmuchane [Image: bouncy-castle.jpg]
│   ├─ 🎢 Zjeżdżalnie [Image: inflatable-slide.jpg]
│   └─ 🏃 Tory przeszkód [Image: obstacle-course.jpg]
│
└─ 🎯 Paintball [Image: paintball-field.jpg]
    │
    ├─ 🌲 Outdoor Paintball [Image: outdoor-paintball.jpg]
    ├─ 🏢 Indoor Paintball [Image: indoor-paintball.jpg]
    └─ 🔫 Laser Tag [Image: laser-tag.jpg]
```

## API Architecture

```
┌─────────────────────────────────────────────────┐
│                 FRONTEND                         │
│  /admin/categories                               │
│  ┌───────────────────────────────────────────┐  │
│  │ CategoryManagementEnhanced Component      │  │
│  │  ├─ Category List (Accordion)             │  │
│  │  ├─ Subcategory List (Nested Cards)       │  │
│  │  ├─ Image Upload UI                       │  │
│  │  └─ CRUD Forms                            │  │
│  └───────────────────────────────────────────┘  │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼ API Calls
┌─────────────────────────────────────────────────┐
│              API ENDPOINTS                       │
├─────────────────────────────────────────────────┤
│  GET    /api/admin/categories                   │
│  POST   /api/admin/categories                   │
│  PATCH  /api/admin/categories                   │
│  DELETE /api/admin/categories?id={id}           │
│                                                  │
│  GET    /api/admin/subcategories                │
│  GET    /api/admin/subcategories?categoryId=x   │
│  POST   /api/admin/subcategories                │
│  PATCH  /api/admin/subcategories                │
│  DELETE /api/admin/subcategories?id={id}        │
│                                                  │
│  POST   /api/upload-category-image              │
└──────────────┬──────────────────┬───────────────┘
               │                  │
               ▼                  ▼
┌──────────────────────┐  ┌──────────────────┐
│   SUPABASE DB        │  │   CLOUDINARY     │
│   (PostgreSQL)       │  │                  │
│  ├─ categories       │  │ Folders:         │
│  ├─ subcategories    │  │ ├─ categories/   │
│  └─ properties       │  │ │   categories/  │
└──────────────────────┘  │ └─ categories/   │
                          │     subcategories/│
                          └──────────────────┘
```

## Data Flow: Image Upload

```
1. User Interaction
   ┌──────────────────────────────────────┐
   │ User clicks "Upload Image" button    │
   │ Selects image file from device       │
   └──────────────┬───────────────────────┘
                  │
2. Client Upload  ▼
   ┌──────────────────────────────────────┐
   │ FormData created with:               │
   │  - image: File                       │
   │  - categoryType: 'category'/'sub'    │
   └──────────────┬───────────────────────┘
                  │
3. Server        ▼
   Validation
   ┌──────────────────────────────────────┐
   │ /api/upload-category-image           │
   │  ├─ Check super admin auth           │
   │  ├─ Validate file type               │
   │  ├─ Validate file size (<5MB)        │
   │  └─ Convert to buffer                │
   └──────────────┬───────────────────────┘
                  │
4. Cloudinary    ▼
   Upload
   ┌──────────────────────────────────────┐
   │ cloudinary.uploader.upload_stream    │
   │  - folder: categories/{type}s        │
   │  - resource_type: image              │
   └──────────────┬───────────────────────┘
                  │
5. Response      ▼
   ┌──────────────────────────────────────┐
   │ Returns to client:                   │
   │  {                                   │
   │    secure_url: "https://res...",     │
   │    public_id: "categories/..."       │
   │  }                                   │
   └──────────────┬───────────────────────┘
                  │
6. Save to DB    ▼
   ┌──────────────────────────────────────┐
   │ Update category/subcategory record:  │
   │  - image_url = secure_url            │
   │  - image_public_id = public_id       │
   └──────────────┬───────────────────────┘
                  │
7. UI Update     ▼
   ┌──────────────────────────────────────┐
   │ Display image preview                │
   │ Show success toast                   │
   │ Enable remove button                 │
   └──────────────────────────────────────┘
```

## Component Structure

```
CategoryManagementEnhanced
│
├─ State Management
│   ├─ categories (with subcategories)
│   ├─ categoryFormData (with image fields)
│   ├─ subcategoryFormData (with image fields)
│   ├─ loading, saving, uploading states
│   └─ dialog open/close states
│
├─ Event Handlers
│   ├─ handleImageUpload(file, type)
│   ├─ handleSaveCategory()
│   ├─ handleSaveSubcategory()
│   ├─ handleDeleteCategory(id)
│   └─ handleDeleteSubcategory(id)
│
└─ UI Components
    ├─ Accordion (categories)
    │   └─ AccordionItem (per category)
    │       ├─ Category Header (with image/icon)
    │       └─ AccordionContent
    │           └─ Subcategories Grid
    │               └─ Card (per subcategory)
    │                   └─ Subcategory info (with image/icon)
    │
    ├─ Dialog (Category CRUD)
    │   ├─ Form fields (name, slug, icon, description)
    │   └─ Image Upload Section
    │       ├─ Upload Button
    │       ├─ Preview Image
    │       └─ Remove Button
    │
    └─ Dialog (Subcategory CRUD)
        ├─ Form fields (name, slug, icon, description)
        └─ Image Upload Section
            ├─ Upload Button
            ├─ Preview Image
            └─ Remove Button
```

## Security Flow

```
Request → Authentication Check → Authorization Check → Input Validation → Process → Response
   │              │                      │                    │              │
   │              ▼                      ▼                    ▼              │
   │      Supabase Auth          Super Admin Role?    File type/size    Success/Error
   │      getUser()              Check users table    Whitelist check    JSON response
   │                                                   
   └─────► If any check fails: Return 401/403/400 with error message
```

## RLS Policies

```
CATEGORIES Table:
├─ SELECT: Anyone (authenticated or anonymous)
│   ├─ Purpose: Public viewing of categories
│   └─ Policy: USING (true)
│
└─ INSERT/UPDATE/DELETE: Super Admin only
    ├─ Purpose: Protected category management
    └─ Policy: USING (auth.uid() = id AND role = 'super_admin')

SUBCATEGORIES Table:
├─ SELECT: Anyone (authenticated or anonymous)
│   ├─ Purpose: Public viewing of subcategories
│   └─ Policy: USING (true)
│
└─ INSERT/UPDATE/DELETE: Super Admin only
    ├─ Purpose: Protected subcategory management
    └─ Policy: USING (auth.uid() = id AND role = 'super_admin')
```

## Image Storage Structure in Cloudinary

```
cloudinary.com/{cloud_name}/
│
└─ categories/
    │
    ├─ categories/
    │   ├─ {public_id_1}.jpg  (e.g., Go-Karts image)
    │   ├─ {public_id_2}.jpg  (e.g., Dmuchańce image)
    │   └─ {public_id_3}.jpg  (e.g., Paintball image)
    │
    └─ subcategories/
        ├─ {public_id_1}.jpg  (e.g., Indoor Karting image)
        ├─ {public_id_2}.jpg  (e.g., Outdoor Karting image)
        └─ {public_id_3}.jpg  (e.g., Electric Karts image)
```

## Type System

```typescript
Category
├─ id: string
├─ name: string
├─ slug: string
├─ icon: string
├─ description?: string
├─ image_url?: string       ← NEW
├─ image_public_id?: string ← NEW
└─ created_at: string

Subcategory
├─ id: string
├─ parent_category_id: string
├─ name: string
├─ slug: string
├─ icon?: string
├─ description?: string
├─ image_url?: string       ← NEW
├─ image_public_id?: string ← NEW
└─ created_at: string

CategoryWithSubcategories
└─ extends Category
    └─ subcategories?: Subcategory[]
```
