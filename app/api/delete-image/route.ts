import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { getRequestId, reportServerError } from "@/lib/monitoring/server"
import { cloudinary } from "@/lib/cloudinary"

// DELETE - Delete an image from Cloudinary
export async function DELETE(request: Request) {
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

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const publicId = body && typeof body === "object" && "publicId" in body
      ? (body as { publicId?: unknown }).publicId
      : null

    if (typeof publicId !== "string" || !publicId.trim()) {
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
    reportServerError(error, {
      area: "media",
      operation: "delete_image",
      route: "/api/delete-image",
      requestId,
    })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
