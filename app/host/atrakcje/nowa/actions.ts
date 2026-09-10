"use server"

import { randomUUID } from "node:crypto"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"

function slugify(value: string) {
  const base = value.toLocaleLowerCase("pl").replaceAll("ł", "l").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80)
  return `${base || "atrakcja"}-${randomUUID().slice(0, 8)}`
}

const schema = z.object({
  organizationId: z.string().uuid(),
  attractionName: z.string().trim().min(2).max(160),
  attractionDescription: z.string().trim().min(20).max(4000),
  categoryId: z.string().uuid(),
  address: z.string().trim().min(3).max(240),
  postalCode: z.string().trim().max(20),
  city: z.string().trim().min(2).max(120),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  ticketName: z.string().trim().min(1).max(120),
  ticketPrice: z.coerce.number().positive().max(1000000),
  durationMinutes: z.coerce.number().int().min(1).max(1440),
  capacity: z.coerce.number().int().min(1).max(100000),
  localStartTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  localEndTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  salesMode: z.enum(["allocated_quota", "native_enjoyhub"]),
  images: z.array(z.object({ url: z.string().url(), publicId: z.string() })).max(8),
  weekdays: z.array(z.coerce.number().int().min(1).max(7)).min(1),
}).refine((input) => input.localStartTime < input.localEndTime, { message: "Sprawdź godziny dostępności." })

export async function addOrganizerAttraction(formData: FormData) {
  if (!isSupabaseConfigured) redirect("/host/atrakcje/nowa?blad=konfiguracja")

  let images: unknown = []
  try { images = JSON.parse(String(formData.get("images") ?? "[]")) } catch { images = null }

  const parsed = schema.safeParse({
    organizationId: formData.get("organizationId"),
    attractionName: formData.get("attractionName"),
    attractionDescription: formData.get("attractionDescription"),
    categoryId: formData.get("categoryId"),
    address: formData.get("address"),
    postalCode: formData.get("postalCode"),
    city: formData.get("city"),
    latitude: formData.get("latitude"),
    longitude: formData.get("longitude"),
    ticketName: formData.get("ticketName"),
    ticketPrice: formData.get("ticketPrice"),
    durationMinutes: formData.get("durationMinutes"),
    capacity: formData.get("capacity"),
    localStartTime: formData.get("localStartTime"),
    localEndTime: formData.get("localEndTime"),
    salesMode: formData.get("salesMode"),
    images,
    weekdays: formData.getAll("weekdays"),
  })

  if (!parsed.success) redirect("/host/atrakcje/nowa?blad=dane")

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login?next=/host/atrakcje/nowa")

  const generationEnd = new Date(); generationEnd.setUTCDate(generationEnd.getUTCDate() + 90)
  const input = parsed.data
  const productName = `Bilet wstępu — ${input.attractionName}`
  const { data, error } = await supabase.rpc("ticketing_add_organizer_attraction", {
    p_organization_id: input.organizationId,
    p_attraction_name: input.attractionName,
    p_attraction_slug: slugify(input.attractionName),
    p_attraction_description: input.attractionDescription,
    p_category_id: input.categoryId,
    p_address: input.address,
    p_postal_code: input.postalCode || null,
    p_city: input.city,
    p_latitude: input.latitude,
    p_longitude: input.longitude,
    p_images: input.images.map((image) => image.url),
    p_sales_mode: input.salesMode,
    p_product_name: productName,
    p_product_slug: slugify(productName),
    p_duration_minutes: input.durationMinutes,
    p_ticket_name: input.ticketName,
    p_ticket_price: input.ticketPrice,
    p_weekdays: [...new Set(input.weekdays)],
    p_local_start_time: input.localStartTime,
    p_local_end_time: input.localEndTime,
    p_capacity: input.capacity,
    p_generate_until: generationEnd.toISOString().slice(0, 10),
  })

  if (error || !data?.[0]) {
    console.error("Additional attraction creation failed", { code: error?.code, message: error?.message })
    redirect(error?.code === "42501" ? "/host/atrakcje/nowa?blad=uprawnienia" : "/host/atrakcje/nowa?blad=zapis")
  }

  const result = data[0] as { created_property_id: string; created_product_id: string }
  revalidatePath("/"); revalidatePath("/host"); revalidatePath("/host/sprzedaz/konfiguracja")
  redirect(`/host/onboarding/gotowe?atrakcja=${result.created_property_id}&oferta=${result.created_product_id}`)
}
