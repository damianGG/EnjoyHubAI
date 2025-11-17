import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { cloudinary } from "@/lib/cloudinary"

// Helper to check if user is super admin
async function isSuperAdmin() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return false
  }

  const { data: userData } = await supabase.from("users").select("role").eq("id", user.id).single()

  return userData?.role === "super_admin"
}

// POST - Upload category/subcategory image to Cloudinary
export async function POST(request: Request) {
  try {
    // Check if user is super admin
    if (!(await isSuperAdmin())) {
      return NextResponse.json({ error: "Unauthorized - super admin access required" }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get("image") as File
    const categoryType = formData.get("categoryType") as string // 'category' or 'subcategory'

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    if (!categoryType || !["category", "subcategory"].includes(categoryType)) {
      return NextResponse.json({ error: "Invalid category type. Must be 'category' or 'subcategory'" }, { status: 400 })
    }

    // Validate file type - only allow images
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"]
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "Only image files are allowed (JPEG, PNG, GIF, WebP)" }, { status: 400 })
    }

    // Validate file size (max 5MB for category images)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: "File size must be less than 5MB" }, { status: 400 })
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Upload to Cloudinary using upload_stream
    const result = await new Promise<any>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: `categories/${categoryType}s`, // 'categories/categories' or 'categories/subcategories'
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
    console.error("Upload error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
