import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { CalendarDays, CheckCircle2, MapPin, ShieldCheck, Ticket, XCircle } from "lucide-react"
import { notFound } from "next/navigation"
import { z } from "zod"

import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { RedeemTicketButton } from "@/components/ticketing/redeem-ticket-button"
import { formatSessionDate } from "@/lib/ticketing/format"
import { canRedeemTicket, getPublicTicket } from "@/lib/ticketing/queries"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Bilet EnjoyHub",
  robots: { index: false, follow: false },
}

export default async function PublicTicketPage({
  params,
}: {
  params: Promise<{ ticketCode: string }>
}) {
  const { ticketCode } = await params
  if (!z.string().uuid().safeParse(ticketCode).success) notFound()

  const [ticket, canRedeem] = await Promise.all([
    getPublicTicket(ticketCode),
    canRedeemTicket(ticketCode),
  ])
  if (!ticket) notFound()

  const isValid = ticket.status === "valid"

  return (
    <main className="min-h-screen bg-gradient-to-b from-primary/10 via-background to-background">
      <div className="container mx-auto max-w-xl px-4 py-8 sm:py-14">
        <div className="mb-7 text-center">
          <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full ${isValid ? "bg-emerald-100" : "bg-red-100"}`}>
            {isValid
              ? <CheckCircle2 className="h-8 w-8 text-emerald-700" />
              : <XCircle className="h-8 w-8 text-red-700" />}
          </div>
          <Badge variant={isValid ? "default" : "destructive"}>
            {isValid ? "Bilet ważny" : ticket.status === "used" ? "Bilet wykorzystany" : "Bilet unieważniony"}
          </Badge>
          <h1 className="mt-3 text-3xl font-bold">{ticket.productName}</h1>
          <p className="mt-2 text-muted-foreground">{ticket.ticketTypeName}</p>
        </div>

        <Card className="surface-3d overflow-hidden">
          <CardContent className="space-y-5 p-6">
            <div className="mx-auto w-fit rounded-2xl border bg-white p-3">
              <Image
                src={`/api/ticketing/tickets/${ticket.ticketCode}/qr`}
                alt="Kod QR biletu"
                width={256}
                height={256}
                unoptimized
                priority
              />
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <CalendarDays className="mt-0.5 h-4 w-4 text-primary" />
                <span>{formatSessionDate(ticket.startsAt, ticket.venueTimezone)}</span>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-4 w-4 text-primary" />
                <span>{[ticket.venueName, ticket.venueCity].filter(Boolean).join(", ")}</span>
              </div>
              <div className="flex items-start gap-3">
                <Ticket className="mt-0.5 h-4 w-4 text-primary" />
                <span>Bilet #{ticket.sequenceNumber}</span>
              </div>
            </div>

            <Separator />

            {canRedeem && isValid && (
              <RedeemTicketButton ticketCode={ticket.ticketCode} />
            )}

            {canRedeem && ticket.status === "used" && (
              <Alert className="border-amber-300 bg-amber-50 text-amber-950">
                <AlertDescription className="text-current/80">
                  Ten bilet został już wykorzystany
                  {ticket.usedAt ? ` ${formatUsedAt(ticket.usedAt)}` : ""}. Nie wpuszczaj gościa ponownie.
                </AlertDescription>
              </Alert>
            )}

            {(canRedeem && (isValid || ticket.status === "used")) && <Separator />}

            <div className="flex items-start gap-3 rounded-xl bg-muted p-4 text-sm">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <p>Okaż ten kod obsłudze obiektu. Strona nie pokazuje danych kupującego.</p>
            </div>

            <p className="break-all text-center font-mono text-xs text-muted-foreground">
              {ticket.ticketCode}
            </p>
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <Button asChild variant="outline">
            <Link href="/">Przejdź do EnjoyHub</Link>
          </Button>
        </div>
      </div>
    </main>
  )
}

function formatUsedAt(value: string) {
  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date(value))
}
