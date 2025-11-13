# Cloudinary Image Management Integration

This document describes the Cloudinary integration for handling image uploads and deletions in the EnjoyHub application.

## Overview

The Cloudinary integration allows users to upload and manage images for their attractions/properties. Each user has their own folder in Cloudinary for organized storage, and all operations are protected by authentication and authorization checks.

## Features

### 1. Secure Image Upload
- **Multiple file upload**: Users can select and upload multiple images at once
- **User-specific folders**: Images are stored in `users/{userId}/` folders for organization
- **File validation**: 
  - Accepted formats: JPEG, JPG, PNG, GIF, WebP
  - Maximum file size: 10MB per image
- **Authentication required**: Only authenticated users can upload images
- **User verification**: Upload requests must match the authenticated user's ID

### 2. Image Deletion
- **Ownership verification**: Users can only delete their own images
- **API-based deletion**: Removes images from both Cloudinary and the database
- **UI feedback**: Toast notifications for success/error states

### 3. Optimized Display
- **Next.js Image component**: Used for automatic optimization and lazy loading
- **Meaningful alt text**: All images have descriptive alt attributes (e.g., "Title – zdjęcie 1")
- **Gallery view**: Interactive gallery with lightbox and thumbnails

## Setup Instructions

### 1. Environment Variables

Add the following variables to your `.env.local` file:

```bash
# Cloudinary credentials (get from https://cloudinary.com/console)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

⚠️ **Security**: Never commit these credentials to version control. They are included in `.gitignore`.

### 2. Cloudinary Account Setup

1. Sign up for a free account at [Cloudinary](https://cloudinary.com)
2. Navigate to the Dashboard
3. Copy your Cloud Name, API Key, and API Secret
4. Add them to your `.env.local` file

### 3. Installation

The Cloudinary package is already installed via:

```bash
npm install cloudinary
```

## Architecture

### File Structure

```
lib/
  cloudinary.ts              # Cloudinary SDK configuration
app/
  api/
    upload/
      route.ts              # Image upload endpoint
    delete-image/
      route.ts              # Image deletion endpoint
components/
  add-attraction-form.tsx   # Form with file upload UI
  attraction-gallery.tsx    # Image gallery display
  featured-attractions.tsx  # Attraction cards with images
```

### Upload Flow

1. User selects image(s) via file input
2. Form data with image file and userId is sent to `/api/upload`
3. API validates:
   - User authentication
   - User ID matches authenticated user
   - File type and size
4. Image is uploaded to Cloudinary using `upload_stream`
5. Response includes `secure_url` and `public_id`
6. UI updates with new image and stores both URL and public_id

### Deletion Flow

1. User clicks remove button on image thumbnail
2. DELETE request sent to `/api/delete-image` with `publicId`
3. API validates:
   - User authentication
   - Public ID belongs to user's folder
4. Image deleted from Cloudinary using `destroy(publicId)`
5. UI removes image from local state
6. Database updated to remove URL from images array

## API Endpoints

### POST /api/upload

Upload an image to Cloudinary.

**Request Body** (FormData):
- `image`: File - The image file to upload
- `userId`: string - The ID of the user uploading the image

**Response**:
```json
{
  "secure_url": "https://res.cloudinary.com/...",
  "public_id": "users/user-id/image-id"
}
```

**Error Responses**:
- `401 Unauthorized`: User not authenticated
- `403 Forbidden`: User ID mismatch
- `400 Bad Request`: Invalid file type or size
- `500 Internal Server Error`: Upload failed

### DELETE /api/delete-image

Delete an image from Cloudinary.

**Request Body** (JSON):
```json
{
  "publicId": "users/user-id/image-id"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Image deleted successfully"
}
```

**Error Responses**:
- `401 Unauthorized`: User not authenticated
- `403 Forbidden`: Image doesn't belong to user
- `400 Bad Request`: Missing publicId or deletion failed
- `500 Internal Server Error`: Deletion failed

## Security Considerations

### Authentication & Authorization
- ✅ All API endpoints require user authentication
- ✅ User ID verification prevents unauthorized uploads
- ✅ Folder path validation prevents cross-user deletions
- ✅ Public IDs are validated to ensure they belong to the user

### File Validation
- ✅ File type whitelist (images only)
- ✅ File size limit (10MB maximum)
- ✅ Server-side validation (cannot be bypassed)

### Data Protection
- ✅ Environment variables for sensitive credentials
- ✅ Credentials never exposed to client
- ✅ Server-side upload using Node SDK

## Usage Example

### In a Component

```typescript
import { useState } from "react"
import { toast } from "sonner"

function ImageUploader({ userId }: { userId: string }) {
  const [images, setImages] = useState<Array<{ url: string; publicId: string }>>([])
  const [uploading, setUploading] = useState(false)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    setUploading(true)
    
    for (const file of Array.from(files)) {
      const formData = new FormData()
      formData.append("image", file)
      formData.append("userId", userId)

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      if (response.ok) {
        const data = await response.json()
        setImages(prev => [...prev, { url: data.secure_url, publicId: data.public_id }])
        toast.success("Image uploaded")
      }
    }
    
    setUploading(false)
  }

  const handleDelete = async (publicId: string) => {
    const response = await fetch("/api/delete-image", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publicId }),
    })

    if (response.ok) {
      setImages(prev => prev.filter(img => img.publicId !== publicId))
      toast.success("Image deleted")
    }
  }

  return (
    <div>
      <input 
        type="file" 
        multiple 
        accept="image/*" 
        onChange={handleUpload}
        disabled={uploading}
      />
      
      {images.map((img, index) => (
        <div key={index}>
          <img src={img.url} alt={`Image ${index + 1}`} />
          <button onClick={() => handleDelete(img.publicId)}>Delete</button>
        </div>
      ))}
    </div>
  )
}
```

## Folder Structure in Cloudinary

Images are organized by user:

```
cloudinary/
  users/
    {userId-1}/
      image-1.jpg
      image-2.png
    {userId-2}/
      image-1.jpg
```

This structure:
- Keeps user images isolated
- Makes it easy to find all images for a user
- Simplifies cleanup when a user is deleted
- Enables user-specific quotas and analytics

## Future Enhancements

### Potential Improvements
1. **Property-level organization**: Consider `properties/{propertyId}/` instead of user-level
2. **Automatic cleanup**: Delete images when property is deleted
3. **Image transformations**: Use Cloudinary transformations for thumbnails
4. **Lazy loading**: Implement progressive image loading
5. **Batch operations**: Allow selecting and deleting multiple images
6. **Image ordering**: Drag-and-drop to reorder images
7. **Image metadata**: Store and display upload date, file size, dimensions

## Troubleshooting

### Upload Fails
- Check Cloudinary credentials in `.env.local`
- Verify file size is under 10MB
- Ensure file type is supported (JPEG, PNG, GIF, WebP)
- Check browser console for error messages

### Delete Fails
- Verify user owns the image
- Check that public_id is correct
- Ensure Cloudinary credentials are valid

### Images Don't Display
- Verify Cloudinary domain is in `next.config.mjs` remote patterns
- Check that URLs are HTTPS
- Ensure images weren't deleted from Cloudinary

## Support

For issues or questions:
1. Check the [Cloudinary Documentation](https://cloudinary.com/documentation)
2. Review API error messages in browser console
3. Check server logs for detailed error information
4. Verify environment variables are set correctly
