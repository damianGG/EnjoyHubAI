"use server"

import { randomUUID } from "node:crypto"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"

export interface SalesSetupActionState {
  error?: string
}

const optionalText = (maximum: number) => z.string().trim().max(maximum)

const salesSetupSchema = z.object({
  existingVenueId: z.union([z.literal("new"), z.string().uuid()]),
  organizationId: z.union([z.literal("new"), z.string().uuid()]),
  organizationName: optionalText(160),
  propertyId: z.union([z.literal("none"), z.string().uuid()]),
  venueName: optionalText(160),
  venueDescription: optionalText(2000),
  addressLine1: optionalText(240),
  postalCode: optionalText(20),
  city: optionalText(120),
  salesMode: z.enum(["native_enjoyhub", "allocated_quota"]),
  productName: z.string().trim().min(2).max(180),
  productDescription: optionalText(4000),
  durationMinutes: z.number().int().min(1).max(1440),
  capacity: z.number().int().min(1).max(100000),
  localStartTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  localEndTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  slotIntervalMinutes: z.number().int().min(1).max(1440),
  salesCutoffMinutes: z.number().int().min(0).max(10080),
  weekdays: z.array(z.number().int().min(1).max(7)).min(1).max(7),
  tickets: z.array(z.object({
    name: z.string().trim().min(1).max(120),
    priceAmount: z.number().positive().max(1000000),
    capacityUnits: z.number().int().min(1).max(100000),
    maxQuantityPerOrder: z.number().int().min(1).max(100),
  })).min(1).max(10),
}).superRefine((input, context) => {
  if (input.existingVenueId === "new") {
    if (input.organizationId === "new" && input.organizationName.length < 2) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["organizationName"],
        message: "Podaj nazwę firmy lub organizacji.",
      })
    }
    if (input.venueName.length < 2) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["venueName"],
        message: "Podaj nazwę obiektu.",
      })
    }
  }

  if (input.tickets.some((ticket) => ticket.capacityUnits > input.capacity)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["tickets"],
      message: "Bilet nie może zajmować więcej miejsc niż pula jednego terminu.",
    })
  }

  const normalizedNames = input.tickets.map((ticket) => ticket.name.toLocaleLowerCase("pl"))
  if (new Set(normalizedNames).size !== normalizedNames.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["tickets"],
      message: "Nazwy rodzajów biletów muszą być różne.",
    })
  }
})

function formText(formData: FormData, name: string) {
  return String(formData.get(name) ?? "")
}

function formNumber(formData: FormData, name: string) {
  return Number(formText(formData, name).replace(",", "."))
}

function slugify(value: string) {
  const base = value
    .toLocaleLowerCase("pl")
    .replaceAll("ł", "l")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)

  return `${base || "oferta"}-${randomUUID().slice(0, 8)}`
}

function setupErrorMessage(error: { code?: string; message?: string } | null) {
  const message = error?.message ?? ""

  if (
    error?.code === "PGRST202"
    || message.includes("ticketing_create_marketplace_sales_setup")
  ) {
    return "Kreator wymaga migracji etapu 2B w Supabase. Po jej uruchomieniu formularz połączy marketplace z nowym ticketingiem."
  }
  if (error?.code === "23505") {
    return "Taka oferta, obiekt lub powiązanie atrakcji już istnieje. Sprawdź wybraną atrakcję i spróbuj ponownie."
  }
  if (error?.code === "42501" || message.toLowerCase().includes("cannot configure")) {
    return "Nie masz uprawnień właściciela, administratora ani managera dla wybranego obiektu."
  }
  if (error?.code === "22023") {
    return "Sprawdź godziny, pojemność i rodzaje biletów. Harmonogram musi tworzyć co najmniej jeden pełny termin."
  }

  return "Nie udało się uruchomić sprzedaży. Dane nie zostały zapisane częściowo — popraw formularz i spróbuj ponownie."
}

export async function createSalesSetup(
  _previousState: SalesSetupActionState,
  formData: FormData,
): Promise<SalesSetupActionState> {
  if (!isSupabaseConfigured) {
    return { error: "Połącz Supabase, aby uruchomić sprzedaż." }
  }

  const ticketNames = formData.getAll("ticketName").map(String)
  const ticketPrices = formData.getAll("ticketPrice").map((value) => Number(String(value).replace(",", ".")))
  const ticketCapacityUnits = formData.getAll("ticketCapacityUnits").map((value) => Number(value))
  const ticketLimits = formData.getAll("ticketMaxQuantity").map((value) => Number(value))

  if (
    ticketNames.length !== ticketPrices.length ||
    ticketNames.length !== ticketCapacityUnits.length ||
    ticketNames.length !== ticketLimits.length
  ) {
    return { error: "Cennik ma niepełne dane. Uzupełnij każdy rodzaj biletu." }
  }

  const parsed = salesSetupSchema.safeParse({
    existingVenueId: formText(formData, "existingVenueId") || "new",
    organizationId: formText(formData, "organizationId") || "new",
    organizationName: formText(formData, "organizationName"),
    propertyId: formText(formData, "propertyId") || "none",
    venueName: formText(formData, "venueName"),
    venueDescription: formText(formData, "venueDescription"),
    addressLine1: formText(formData, "addressLine1"),
    postalCode: formText(formData, "postalCode"),
    city: formText(formData, "city"),
    salesMode: formText(formData, "salesMode"),
    productName: formText(formData, "productName"),
    productDescription: formText(formData, "productDescription"),
    durationMinutes: formNumber(formData, "durationMinutes"),
    capacity: formNumber(formData, "capacity"),
    localStartTime: formText(formData, "localStartTime"),
    localEndTime: formText(formData, "localEndTime"),
    slotIntervalMinutes: formNumber(formData, "slotIntervalMinutes"),
    salesCutoffMinutes: formNumber(formData, "salesCutoffMinutes"),
    weekdays: formData.getAll("weekdays").map(Number),
    tickets: ticketNames.map((name, index) => ({
      name,
      priceAmount: ticketPrices[index],
      capacityUnits: ticketCapacityUnits[index],
      maxQuantityPerOrder: ticketLimits[index],
    })),
  })

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Sprawdź dane formularza.",
    }
  }

  const input = parsed.data
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const generationEnd = new Date()
  generationEnd.setUTCDate(generationEnd.getUTCDate() + 90)

  const { data, error } = await supabase.rpc("ticketing_create_marketplace_sales_setup", {
    p_organization_id: input.existingVenueId === "new" && input.organizationId !== "new"
      ? input.organizationId
      : null,
    p_existing_venue_id: input.existingVenueId === "new" ? null : input.existingVenueId,
    p_organization_name: input.organizationId === "new" ? input.organizationName : null,
    p_venue_name: input.existingVenueId === "new" ? input.venueName : null,
    p_venue_slug: input.existingVenueId === "new" ? slugify(input.venueName) : null,
    p_venue_description: input.existingVenueId === "new" ? input.venueDescription || null : null,
    p_address_line_1: input.existingVenueId === "new" ? input.addressLine1 || null : null,
    p_postal_code: input.existingVenueId === "new" ? input.postalCode || null : null,
    p_city: input.existingVenueId === "new" ? input.city || null : null,
    p_sales_mode: input.salesMode,
    p_product_name: input.productName,
    p_product_slug: slugify(input.productName),
    p_product_description: input.productDescription || null,
    p_duration_minutes: input.durationMinutes,
    p_ticket_types: input.tickets.map((ticket) => ({
      name: ticket.name,
      price_amount: ticket.priceAmount,
      capacity_units: ticket.capacityUnits,
      max_quantity_per_order: ticket.maxQuantityPerOrder,
    })),
    p_weekdays: [...new Set(input.weekdays)],
    p_local_start_time: input.localStartTime,
    p_local_end_time: input.localEndTime,
    p_slot_interval_minutes: input.slotIntervalMinutes,
    p_capacity: input.capacity,
    p_sales_cutoff_minutes: input.salesCutoffMinutes,
    p_generate_until: generationEnd.toISOString().slice(0, 10),
    p_property_id: input.propertyId === "none" ? null : input.propertyId,
  })

  if (error || !data?.[0]) {
    console.error("Ticketing self-service setup failed", {
      code: error?.code,
      message: error?.message,
    })
    return { error: setupErrorMessage(error) }
  }

  const result = data[0] as { created_product_id: string }
  revalidatePath("/checkout")
  revalidatePath("/host")
  revalidatePath("/host/sprzedaz")
  revalidatePath("/host/sprzedaz/konfiguracja")
  redirect(`/host/sprzedaz/konfiguracja?utworzono=${result.created_product_id}`)
}

export async function linkTicketingVenueToProperty(formData: FormData) {
  const parsed = z.object({
    venueId: z.string().uuid(),
    propertyId: z.string().uuid(),
  }).safeParse({
    venueId: formText(formData, "venueId"),
    propertyId: formText(formData, "propertyId"),
  })

  if (!parsed.success || !isSupabaseConfigured) {
    redirect("/host/sprzedaz/konfiguracja?blad=powiazanie")
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { error } = await supabase.rpc("ticketing_link_venue_property", {
    p_venue_id: parsed.data.venueId,
    p_property_id: parsed.data.propertyId,
  })

  if (error) {
    console.error("Ticketing marketplace link failed", {
      code: error.code,
      message: error.message,
    })
    redirect("/host/sprzedaz/konfiguracja?blad=powiazanie")
  }

  revalidatePath("/")
  revalidatePath(`/attractions/${parsed.data.propertyId}`)
  revalidatePath("/host/sprzedaz/konfiguracja")
  redirect("/host/sprzedaz/konfiguracja?powiazano=1")
}

export async function changeTicketingProductStatus(formData: FormData) {
  const parsed = z.object({
    productId: z.string().uuid(),
    nextStatus: z.enum(["active", "draft"]),
  }).safeParse({
    productId: formText(formData, "productId"),
    nextStatus: formText(formData, "nextStatus"),
  })

  if (!parsed.success || !isSupabaseConfigured) {
    redirect("/host/sprzedaz/konfiguracja?blad=status")
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data, error } = await supabase
    .from("products")
    .update({ status: parsed.data.nextStatus })
    .eq("id", parsed.data.productId)
    .select("id")
    .single()

  if (error || !data) {
    console.error("Ticketing product status update failed", {
      code: error?.code,
      message: error?.message,
    })
    redirect("/host/sprzedaz/konfiguracja?blad=status")
  }

  revalidatePath("/checkout")
  revalidatePath(`/bilety/${parsed.data.productId}`)
  revalidatePath("/host/sprzedaz/konfiguracja")
  redirect(`/host/sprzedaz/konfiguracja?zmiana=${parsed.data.nextStatus}`)
}
