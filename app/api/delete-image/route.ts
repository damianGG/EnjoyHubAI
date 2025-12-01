import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { cloudinary } from "@/lib/cloudinary"

// DELETE - Delete an image from Cloudinary
export async function DELETE(request: Request) {
  try {
    // Check if user is authenticated
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { publicId } = body

    if (!publicId) {
      return NextResponse.json({ error: "Public ID is required" }, { status: 400 })
    }

    // Verify the public_id belongs to the user's folder
    if (!publicId.startsWith(`users/${user.id}/`)) {
      return NextResponse.json({ error: "Unauthorized - you can only delete your own images" }, { status: 403 })
    }

    // Delete from Cloudinary
    const result = await cloudinary.uploader.destroy(publicId)

    if (result.result === "ok" || result.result === "not found") {
      return NextResponse.json({ success: true, message: "Image deleted successfully" })
    } else {
      return NextResponse.json({ error: "Failed to delete image" }, { status: 400 })
    }
  } catch (error) {
    console.error("Delete error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
