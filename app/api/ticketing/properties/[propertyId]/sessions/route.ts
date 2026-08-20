import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { isTicketingCheckoutEnabled } from "@/lib/ticketing/config"
import { listMarketplacePropertySessions } from "@/lib/ticketing/marketplace"

export const dynamic = "force-dynamic"

const paramsSchema = z.object({
  propertyId: z.string().uuid(),
})

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const [year, month, day] = value.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> },
) {
  if (!isTicketingCheckoutEnabled) {
    return NextResponse.json({ error: "Sprzedaż biletów jest wyłączona." }, { status: 404 })
  }

  const resolvedParams = await params
  const requestUrl = new URL(request.url)
  const parsedParams = paramsSchema.safeParse(resolvedParams)
  const startDate = requestUrl.searchParams.get("start")
  const endDate = requestUrl.searchParams.get("end")
  const parsedStart = dateSchema.safeParse(startDate)
  const parsedEnd = dateSchema.safeParse(endDate)

  if (!parsedParams.success || !parsedStart.success || !parsedEnd.success) {
    return NextResponse.json(
      { error: "Podaj prawidłowy obiekt oraz zakres dat YYYY-MM-DD." },
      { status: 400 },
    )
  }

  const start = new Date(`${parsedStart.data}T00:00:00Z`)
  const end = new Date(`${parsedEnd.data}T00:00:00Z`)
  const rangeDays = Math.round((end.getTime() - start.getTime()) / 86_400_000)
  if (rangeDays < 0 || rangeDays > 92) {
    return NextResponse.json(
      { error: "Zakres kalendarza może obejmować maksymalnie 93 dni." },
      { status: 400 },
    )
  }

  const sessions = await listMarketplacePropertySessions(
    parsedParams.data.propertyId,
    parsedStart.data,
    parsedEnd.data,
  )
  const response = NextResponse.json({ sessions })
  response.headers.set("Cache-Control", "private, no-store")
  return response
}
