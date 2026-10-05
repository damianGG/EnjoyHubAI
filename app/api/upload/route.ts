import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { getRequestId, reportServerError } from "@/lib/monitoring/server"
import { cloudinary } from "@/lib/cloudinary"

// POST - Upload file to Cloudinary
export async function POST(request: Request) {
  const requestId = getRequestId(request)
  try {
    // Check if user is authenticated
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get("image")
    const userId = formData.get("userId")

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No valid image file provided" }, { status: 400 })
    }

    if (typeof userId !== "string" || !userId.trim()) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    // Verify the userId matches the authenticated user
    if (userId !== user.id) {
      return NextResponse.json({ error: "Unauthorized - user ID mismatch" }, { status: 403 })
    }

    // Validate file type - only allow images
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"]
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "Only image files are allowed (JPEG, PNG, GIF, WebP)" }, { status: 400 })
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: "File size must be less than 10MB" }, { status: 400 })
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Upload to Cloudinary using upload_stream
    const result = await new Promise<any>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: `users/${userId}`,
          resource_type: "image",
        },
        (error, result) => {
          if (error) reject(error)
          else resolve(result)
        }
      )
      uploadStream.end(buffer)
    })

    return NextResponse.json({
      secure_url: result.secure_url,
      public_id: result.public_id,
    })
  } catch (error) {
    reportServerError(error, {
      area: "media",
      operation: "upload_image",
      route: "/api/upload",
      requestId,
    })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
