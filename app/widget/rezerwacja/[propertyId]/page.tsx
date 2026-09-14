import type { Metadata } from "next"
import Link from "next/link"
import { CalendarX2, ExternalLink, Ticket } from "lucide-react"

import { MarketplaceCalendar } from "@/components/ticketing/marketplace-calendar"
import { getMarketplaceTicketingVenue } from "@/lib/ticketing/marketplace"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Rezerwacja online | EnjoyHub",
  robots: {
    index: false,
    follow: false,
  },
}

export default async function BookingWidgetPage({
  params,
}: {
  params: Promise<{ propertyId: string }>
}) {
  const { propertyId } = await params
  const venue = await getMarketplaceTicketingVenue(propertyId)

  return (
    <main className="min-h-screen bg-white p-2 sm:p-3">
      <div className="mx-auto w-full max-w-[430px]">
        {venue ? (
          <>
            <MarketplaceCalendar propertyId={propertyId} embedded checkoutTarget="_blank" />
            <div className="mt-2 flex items-center justify-between gap-3 px-2 py-2 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <Ticket className="h-3.5 w-3.5 text-[#ff5a1f]" />
                Rezerwacje obsługuje EnjoyHub
              </span>
              <Link
                href={`/attractions/${propertyId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-[#ff5a1f] hover:underline"
              >
                Zobacz profil <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-dashed p-6 text-center">
            <CalendarX2 className="mx-auto h-8 w-8 text-muted-foreground" />
            <h1 className="mt-3 font-semibold">Rezerwacja online jest jeszcze niedostępna</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Ten obiekt nie ma obecnie aktywnego połączenia z ticketingiem EnjoyHub.
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
