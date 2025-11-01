import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// POST - Upload file to Cloudinary
export async function POST(request: Request) {
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
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Check if Cloudinary is configured
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET

    if (!cloudName || !uploadPreset) {
      // Fallback: return a placeholder URL if Cloudinary is not configured
      console.warn("Cloudinary is not configured. Using placeholder.")
      return NextResponse.json({
        url: `https://via.placeholder.com/400x300.png?text=${encodeURIComponent(file.name)}`,
        public_id: `placeholder-${Date.now()}`,
      })
    }

    // Upload to Cloudinary
    const cloudinaryFormData = new FormData()
    cloudinaryFormData.append("file", file)
    cloudinaryFormData.append("upload_preset", uploadPreset)
    cloudinaryFormData.append("folder", "enjoyhub")

    const cloudinaryResponse = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: "POST",
      body: cloudinaryFormData,
    })

    if (!cloudinaryResponse.ok) {
      const errorData = await cloudinaryResponse.json()
      return NextResponse.json({ error: errorData.error?.message || "Upload failed" }, { status: 400 })
    }

    const result = await cloudinaryResponse.json()

    return NextResponse.json({
      url: result.secure_url,
      public_id: result.public_id,
    })
  } catch (error) {
    console.error("Upload error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
