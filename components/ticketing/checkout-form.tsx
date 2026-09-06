"use client"

import { useMemo, useRef, useState } from "react"
import type { FormEvent } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Loader2, Minus, Plus, ShieldCheck, Ticket, UserRound } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { formatMoney } from "@/lib/ticketing/format"
import type { CheckoutOrderResult, TicketingCheckoutSession } from "@/lib/ticketing/types"

interface CheckoutFormProps {
  session: TicketingCheckoutSession
}

export function CheckoutForm({ session }: CheckoutFormProps) {
  const router = useRouter()
  const checkoutKey = useRef<string | null>(null)
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selected = useMemo(() => session.ticketTypes.flatMap((ticket) => {
    const quantity = quantities[ticket.id] ?? 0
    return quantity > 0 ? [{ ticket, quantity }] : []
  }), [quantities, session.ticketTypes])

  const totalAmount = selected.reduce((sum, item) => sum + item.ticket.priceAmount * item.quantity, 0)
  const capacityUnits = selected.reduce((sum, item) => sum + item.ticket.capacityUnits * item.quantity, 0)
  const currency = session.ticketTypes[0]?.currency ?? "PLN"

  function changeQuantity(ticketId: string, direction: 1 | -1) {
    const ticket = session.ticketTypes.find((item) => item.id === ticketId)
    if (!ticket) return

    setError(null)
    setQuantities((current) => {
      const quantity = current[ticketId] ?? 0
      const currentCapacityUnits = session.ticketTypes.reduce(
        (sum, item) => sum + (current[item.id] ?? 0) * item.capacityUnits,
        0,
      )
      let nextQuantity: number

      if (direction === 1) {
        nextQuantity = quantity === 0 ? ticket.minQuantity : quantity + 1
        if (ticket.maxQuantity !== null && nextQuantity > ticket.maxQuantity) return current

        const addedUnits = (nextQuantity - quantity) * ticket.capacityUnits
        if (currentCapacityUnits + addedUnits > session.availableCapacity) return current
        if (session.product.maxParticipants !== null && currentCapacityUnits + addedUnits > session.product.maxParticipants) return current
      } else {
        nextQuantity = quantity <= ticket.minQuantity ? 0 : quantity - 1
      }

      return { ...current, [ticketId]: nextQuantity }
    })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (capacityUnits < session.product.minParticipants) {
      setError(`Wybierz bilety dla co najmniej ${session.product.minParticipants} osób.`)
      return
    }

    if (!termsAccepted) {
      setError("Zaakceptuj regulamin, aby przejść do płatności.")
      return
    }

    const formData = new FormData(event.currentTarget)
    checkoutKey.current ??= crypto.randomUUID()
    setIsSubmitting(true)

    try {
      const response = await fetch("/api/ticketing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkoutKey: checkoutKey.current,
          sessionId: session.id,
          customerName: formData.get("customerName"),
          customerEmail: formData.get("customerEmail"),
          customerPhone: formData.get("customerPhone") || null,
          termsAccepted,
          items: selected.map(({ ticket, quantity }) => ({ ticketTypeId: ticket.id, quantity })),
        }),
      })

      const result = await response.json() as CheckoutOrderResult & { error?: string }
      if (!response.ok) {
        setError(result.error || "Nie udało się zablokować biletów.")
        if (response.status !== 500 && response.status !== 503) checkoutKey.current = null
        return
      }

      router.push(`/checkout/zamowienie/${result.orderId}`)
    } catch {
      setError("Przerwano połączenie. Spróbuj ponownie — nie utworzymy duplikatu.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Card className="overflow-hidden rounded-3xl border-0 bg-white shadow-sm ring-1 ring-black/5">
        <CardContent className="p-0">
          <div className="flex items-center gap-3 border-b p-5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#fff1eb] font-bold text-[#ff5a1f]">1</span>
            <div>
              <p className="font-bold">Wybierz bilety</p>
              <p className="text-xs text-muted-foreground">Dodaj tylko tyle osób, ile faktycznie przyjdzie.</p>
            </div>
            <Ticket className="ml-auto h-5 w-5 text-muted-foreground" />
          </div>

          {session.ticketTypes.map((ticket, index) => {
            const quantity = quantities[ticket.id] ?? 0
            const nextQuantity = quantity === 0 ? ticket.minQuantity : quantity + 1
            const addedCapacityUnits = (nextQuantity - quantity) * ticket.capacityUnits
            const canAdd =
              (ticket.maxQuantity === null || nextQuantity <= ticket.maxQuantity) &&
              capacityUnits + addedCapacityUnits <= session.availableCapacity &&
              (session.product.maxParticipants === null || capacityUnits + addedCapacityUnits <= session.product.maxParticipants)

            return (
              <div key={ticket.id}>
                {index > 0 && <Separator />}
                <div className="flex items-center justify-between gap-4 p-5">
                  <div className="min-w-0">
                    <p className="font-semibold">{ticket.name}</p>
                    {ticket.description && <p className="mt-1 text-sm text-muted-foreground">{ticket.description}</p>}
                    <p className="mt-2 font-bold text-[#0b1220]">{formatMoney(ticket.priceAmount, ticket.currency)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 rounded-full border bg-muted/30 p-1" aria-label={`Liczba biletów: ${ticket.name}`}>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => changeQuantity(ticket.id, -1)}
                      disabled={quantity === 0 || isSubmitting}
                      className="h-9 w-9 rounded-full bg-white shadow-sm"
                      aria-label={`Usuń bilet ${ticket.name}`}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-7 text-center text-base font-bold" aria-live="polite">{quantity}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => changeQuantity(ticket.id, 1)}
                      disabled={!canAdd || isSubmitting}
                      className="h-9 w-9 rounded-full bg-[#ff5a1f] text-white shadow-sm hover:bg-[#e94f18] hover:text-white"
                      aria-label={`Dodaj bilet ${ticket.name}`}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-0 bg-white shadow-sm ring-1 ring-black/5">
        <CardContent className="p-5">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#fff1eb] font-bold text-[#ff5a1f]">2</span>
            <div>
              <p className="font-bold">Twoje dane</p>
              <p className="text-xs text-muted-foreground">Na ten e-mail wyślemy potwierdzenie i bilety.</p>
            </div>
            <UserRound className="ml-auto h-5 w-5 text-muted-foreground" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="customerName">Imię i nazwisko</Label>
              <Input id="customerName" name="customerName" autoComplete="name" minLength={2} maxLength={160} required className="h-12 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customerEmail">E-mail</Label>
              <Input id="customerEmail" name="customerEmail" type="email" autoComplete="email" required className="h-12 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customerPhone">Telefon <span className="text-muted-foreground">(opcjonalnie)</span></Label>
              <Input id="customerPhone" name="customerPhone" type="tel" autoComplete="tel" maxLength={40} className="h-12 rounded-xl" />
            </div>
          </div>

          <label htmlFor="termsAccepted" className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border bg-muted/20 p-4">
            <Checkbox
              id="termsAccepted"
              checked={termsAccepted}
              onCheckedChange={(checked) => setTermsAccepted(checked === true)}
              className="mt-0.5"
              required
            />
            <span className="text-sm leading-relaxed">Akceptuję regulamin sprzedaży i zasady anulowania tej oferty.</span>
          </label>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive" role="alert" className="rounded-2xl">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="sticky bottom-3 z-20 rounded-3xl border bg-white/95 p-4 shadow-2xl backdrop-blur ring-1 ring-black/5 sm:static sm:shadow-lg">
        <div className="mb-3 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Wybrane miejsca</span>
          <span className="font-medium">{capacityUnits} / {session.availableCapacity}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="shrink-0">
            <p className="text-xs text-muted-foreground">Razem</p>
            <p className="text-2xl font-black">{formatMoney(totalAmount, currency)}</p>
          </div>
          <Button
            type="submit"
            size="lg"
            disabled={isSubmitting || capacityUnits === 0}
            className="h-12 flex-1 rounded-xl bg-[#ff5a1f] font-semibold text-white hover:bg-[#e94f18] sm:max-w-xs"
          >
            {isSubmitting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Rezerwuję…</>
            ) : (
              <>Przejdź do płatności<ArrowRight className="ml-2 h-4 w-4" /></>
            )}
          </Button>
        </div>
        <div className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
          Po kliknięciu miejsca zostaną bezpiecznie zablokowane na 15 minut, a następnie przejdziesz do płatności.
        </div>
      </div>
    </form>
  )
}
