"use server"

import { randomUUID } from "node:crypto"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"

export interface OrganizerOnboardingActionState {
  error?: string
}

const optionalText = (maximum: number) => z.string().trim().max(maximum)

const organizerOnboardingSchema = z.object({
  organizationName: z.string().trim().min(2, "Podaj nazwę firmy lub organizacji.").max(160),
  legalName: optionalText(240),
  taxId: optionalText(32),
  billingEmail: z.string().trim().email("Podaj prawidłowy e-mail rozliczeniowy.").max(254),
  attractionName: z.string().trim().min(2, "Podaj nazwę atrakcji.").max(160),
  attractionDescription: z.string().trim().min(20, "Opis atrakcji powinien mieć co najmniej 20 znaków.").max(4000),
  categoryId: z.string().uuid("Wybierz kategorię atrakcji."),
  address: z.string().trim().min(3, "Podaj adres obiektu.").max(240),
  postalCode: optionalText(20),
  city: z.string().trim().min(2, "Podaj miejscowość.").max(120),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  images: z.array(z.object({
    url: z.string().url().refine(
      (url) => url.startsWith("https://res.cloudinary.com/"),
      "Zdjęcie musi pochodzić z bezpiecznego magazynu EnjoyHub.",
    ),
    publicId: z.string().max(500),
  })).max(8),
  salesMode: z.enum(["native_enjoyhub", "allocated_quota"]),
  productName: z.string().trim().min(2, "Podaj nazwę oferty.").max(180),
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
  accepted: z.literal("yes"),
}).superRefine((input, context) => {
  const normalizedTaxId = input.taxId.replace(/[^0-9]/g, "")
  if (input.taxId && normalizedTaxId.length !== 10) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["taxId"],
      message: "Polski NIP powinien zawierać 10 cyfr.",
    })
  }

  if (input.localStartTime >= input.localEndTime) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["localEndTime"],
      message: "Godzina zakończenia musi być późniejsza niż pierwsze wejście.",
    })
  }

  if (input.tickets.some((ticket) => ticket.capacityUnits > input.capacity)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["tickets"],
      message: "Bilet nie może zajmować więcej miejsc niż pula jednego terminu.",
    })
  }

  const normalizedTicketNames = input.tickets.map((ticket) => ticket.name.toLocaleLowerCase("pl"))
  if (new Set(normalizedTicketNames).size !== normalizedTicketNames.length) {
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
  const value = formText(formData, name).trim()
  return value ? Number(value.replace(",", ".")) : Number.NaN
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

function parseImages(value: string) {
  try {
    return JSON.parse(value || "[]") as unknown
  } catch {
    return null
  }
}

function onboardingErrorMessage(error: { code?: string; message?: string } | null) {
  const message = error?.message ?? ""

  if (error?.code === "PGRST202" || message.includes("ticketing_complete_organizer_onboarding")) {
    return "Kreator organizatora nie jest jeszcze aktywny w Supabase. Administrator EnjoyHub musi uruchomić najnowszą migrację."
  }
  if (error?.code === "23503" || message.toLowerCase().includes("category")) {
    return "Wybrana kategoria nie jest już dostępna. Odśwież stronę i wybierz ją ponownie."
  }
  if (error?.code === "23505") {
    return "Taka konfiguracja już istnieje. Wróć do panelu i sprawdź swoje obiekty."
  }
  if (error?.code === "42501") {
    return "Sesja logowania wygasła albo nie masz uprawnień do tej operacji. Zaloguj się ponownie."
  }
  if (error?.code === "22023") {
    return "Sprawdź godziny, bilety i liczbę miejsc. Harmonogram musi tworzyć co najmniej jeden pełny termin."
  }

  return "Nie udało się utworzyć konfiguracji. Nic nie zostało zapisane częściowo — sprawdź dane i spróbuj ponownie."
}

export async function completeOrganizerOnboarding(
  _previousState: OrganizerOnboardingActionState,
  formData: FormData,
): Promise<OrganizerOnboardingActionState> {
  if (!isSupabaseConfigured) {
    return { error: "Połącz Supabase, aby uruchomić sprzedaż." }
  }

  const ticketNames = formData.getAll("ticketName").map(String)
  const ticketPrices = formData.getAll("ticketPrice").map((value) => Number(String(value).replace(",", ".")))
  const ticketCapacityUnits = formData.getAll("ticketCapacityUnits").map(Number)
  const ticketLimits = formData.getAll("ticketMaxQuantity").map(Number)

  if (
    ticketNames.length !== ticketPrices.length
    || ticketNames.length !== ticketCapacityUnits.length
    || ticketNames.length !== ticketLimits.length
  ) {
    return { error: "Cennik ma niepełne dane. Uzupełnij każdy rodzaj biletu." }
  }

  const parsed = organizerOnboardingSchema.safeParse({
    organizationName: formText(formData, "organizationName"),
    legalName: formText(formData, "legalName"),
    taxId: formText(formData, "taxId"),
    billingEmail: formText(formData, "billingEmail"),
    attractionName: formText(formData, "attractionName"),
    attractionDescription: formText(formData, "attractionDescription"),
    categoryId: formText(formData, "categoryId"),
    address: formText(formData, "address"),
    postalCode: formText(formData, "postalCode"),
    city: formText(formData, "city"),
    latitude: formNumber(formData, "latitude"),
    longitude: formNumber(formData, "longitude"),
    images: parseImages(formText(formData, "propertyImages")),
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
    accepted: formText(formData, "accepted"),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Sprawdź dane formularza." }
  }

  const input = parsed.data
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login?next=/host/start")

  const generationEnd = new Date()
  generationEnd.setUTCDate(generationEnd.getUTCDate() + 90)

  const { data, error } = await supabase.rpc("ticketing_complete_organizer_onboarding", {
    p_organization_name: input.organizationName,
    p_legal_name: input.legalName || null,
    p_tax_id: input.taxId.replace(/[^0-9]/g, "") || null,
    p_billing_email: input.billingEmail,
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
  })

  if (error || !data?.[0]) {
    console.error("Organizer onboarding failed", {
      code: error?.code,
      message: error?.message,
    })
    return { error: onboardingErrorMessage(error) }
  }

  const result = data[0] as {
    created_property_id: string
    created_product_id: string
  }

  revalidatePath("/")
  revalidatePath("/host")
  revalidatePath("/host/sprzedaz")
  revalidatePath("/host/sprzedaz/konfiguracja")
  revalidatePath(`/attractions/${result.created_property_id}`)
  redirect(`/host/onboarding/gotowe?atrakcja=${result.created_property_id}&oferta=${result.created_product_id}`)
  return {}
}
