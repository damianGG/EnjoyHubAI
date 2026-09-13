import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"

import { cloudinary } from "@/lib/cloudinary"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

const allowedRoles = new Set(["platform_superadmin", "platform_support", "platform_content"])
const allowedTypes = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"])
const maxSize = 10 * 1024 * 1024

async function authorize() {
  const supabase = createClient()
  const [{ data: { user } }, { data: role }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.rpc("platform_current_staff_role"),
  ])
  if (!user || !role || !allowedRoles.has(String(role))) return null
  return { supabase, user }
}

function refresh(leadId: string) {
  revalidatePath(`/admin/supply/${leadId}`)
  revalidatePath(`/admin/supply/${leadId}/podglad`)
  revalidatePath("/attractions")
  revalidatePath("/attractions/[slug]", "page")
}

export async function POST(request: Request, { params }: { params: Promise<{ leadId: string }> }) {
  const auth = await authorize()
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { leadId } = await params
  const formData = await request.formData()
  const file = formData.get("image")
  const sourceType = String(formData.get("sourceType") || "admin")
  const sourceUrl = String(formData.get("sourceUrl") || "").trim()
  const rightsConfirmed = formData.get("rightsConfirmed") === "true"
  const isPrimary = formData.get("isPrimary") === "true"

  if (!(file instanceof File)) return NextResponse.json({ error: "Brak pliku" }, { status: 400 })
  if (!allowedTypes.has(file.type)) return NextResponse.json({ error: "Dozwolone są JPG, PNG i WebP" }, { status: 400 })
  if (file.size > maxSize) return NextResponse.json({ error: "Maksymalny rozmiar zdjęcia to 10 MB" }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  let publicId: string | null = null

  try {
    const uploaded = await new Promise<any>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: `supply/${leadId}`, resource_type: "image" },
        (error, result) => error ? reject(error) : resolve(result),
      )
      stream.end(buffer)
    })
    publicId = uploaded.public_id

    const { data: imageId, error } = await auth.supabase.rpc("platform_supply_add_image", {
      p_lead_id: leadId,
      p_image_url: uploaded.secure_url,
      p_cloudinary_public_id: uploaded.public_id,
      p_source_type: sourceType,
      p_source_url: sourceUrl || null,
      p_rights_confirmed: rightsConfirmed,
      p_is_primary: isPrimary,
    })

    if (error) throw error
    refresh(leadId)
    return NextResponse.json({ id: imageId, image_url: uploaded.secure_url })
  } catch (error) {
    if (publicId) await cloudinary.uploader.destroy(publicId).catch(() => undefined)
    console.error("Supply image upload failed", error)
    return NextResponse.json({ error: "Nie udało się zapisać zdjęcia" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ leadId: string }> }) {
  const auth = await authorize()
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { leadId } = await params
  const body = await request.json().catch(() => null) as { imageId?: string } | null
  if (!body?.imageId) return NextResponse.json({ error: "Brak identyfikatora zdjęcia" }, { status: 400 })

  const { data: publicId, error } = await auth.supabase.rpc("platform_supply_remove_image", { p_image_id: body.imageId })
  if (error) return NextResponse.json({ error: "Nie udało się usunąć zdjęcia" }, { status: 400 })

  if (publicId) await cloudinary.uploader.destroy(String(publicId)).catch(() => undefined)
  refresh(leadId)
  return NextResponse.json({ ok: true })
}
