"use client"

import { useMemo, useRef, useState } from "react"
import type { FormEvent } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, Loader2, Minus, Plus, ShieldCheck, Ticket } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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

  const totalAmount = selected.reduce(
    (sum, item) => sum + item.ticket.priceAmount * item.quantity,
    0,
  )
  const capacityUnits = selected.reduce(
    (sum, item) => sum + item.ticket.capacityUnits * item.quantity,
    0,
  )
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
        if (ticket.maxQuantity !== null && nextQuantity > ticket.maxQuantity) {
          return current
        }

        const addedUnits = (nextQuantity - quantity) * ticket.capacityUnits
        if (currentCapacityUnits + addedUnits > session.availableCapacity) return current
        if (
          session.product.maxParticipants !== null &&
          currentCapacityUnits + addedUnits > session.product.maxParticipants
        ) return current
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
      setError("Zaakceptuj regulamin, aby zablokować bilety.")
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
          items: selected.map(({ ticket, quantity }) => ({
            ticketTypeId: ticket.id,
            quantity,
          })),
        }),
      })

      const result = await response.json() as CheckoutOrderResult & { error?: string }
      if (!response.ok) {
        setError(result.error || "Nie udało się zablokować biletów.")
        if (response.status !== 500 && response.status !== 503) {
          checkoutKey.current = null
        }
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
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card className="surface-3d overflow-hidden">
        <CardHeader className="bg-muted/40">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Ticket className="h-5 w-5 text-primary" />
            Wybierz bilety
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 p-0">
          {session.ticketTypes.map((ticket, index) => {
            const quantity = quantities[ticket.id] ?? 0
            const nextQuantity = quantity === 0 ? ticket.minQuantity : quantity + 1
            const addedCapacityUnits = (nextQuantity - quantity) * ticket.capacityUnits
            const canAdd =
              (ticket.maxQuantity === null || nextQuantity <= ticket.maxQuantity) &&
              capacityUnits + addedCapacityUnits <= session.availableCapacity &&
              (
                session.product.maxParticipants === null ||
                capacityUnits + addedCapacityUnits <= session.product.maxParticipants
              )
            return (
              <div key={ticket.id}>
                {index > 0 && <Separator />}
                <div className="flex items-center justify-between gap-4 p-5">
                  <div className="min-w-0">
                    <p className="font-semibold">{ticket.name}</p>
                    {ticket.description && (
                      <p className="mt-1 text-sm text-muted-foreground">{ticket.description}</p>
                    )}
                    <p className="mt-2 font-medium text-primary">
                      {formatMoney(ticket.priceAmount, ticket.currency)}
                    </p>
                    {ticket.capacityUnits > 1 && (
                      <p className="text-xs text-muted-foreground">
                        Jeden bilet zajmuje {ticket.capacityUnits} miejsca
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-3" aria-label={`Liczba biletów: ${ticket.name}`}>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => changeQuantity(ticket.id, -1)}
                      disabled={quantity === 0 || isSubmitting}
                      aria-label={`Usuń bilet ${ticket.name}`}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-6 text-center text-lg font-semibold" aria-live="polite">
                      {quantity}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => changeQuantity(ticket.id, 1)}
                      disabled={!canAdd || isSubmitting}
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

      <Card className="surface-3d">
        <CardHeader>
          <CardTitle className="text-xl">Dane kupującego</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="customerName">Imię i nazwisko</Label>
            <Input id="customerName" name="customerName" autoComplete="name" minLength={2} maxLength={160} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="customerEmail">E-mail</Label>
            <Input id="customerEmail" name="customerEmail" type="email" autoComplete="email" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="customerPhone">Telefon <span className="text-muted-foreground">(opcjonalnie)</span></Label>
            <Input id="customerPhone" name="customerPhone" type="tel" autoComplete="tel" maxLength={40} />
          </div>
          <label htmlFor="termsAccepted" className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 sm:col-span-2">
            <Checkbox
              id="termsAccepted"
              checked={termsAccepted}
              onCheckedChange={(checked) => setTermsAccepted(checked === true)}
              className="mt-0.5"
              required
            />
            <span className="text-sm leading-relaxed">
              Akceptuję regulamin sprzedaży i zasady anulowania tej oferty.
            </span>
          </label>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="surface-3d border-primary/20">
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Wybrane miejsca</span>
            <span className="font-medium">{capacityUnits} z {session.availableCapacity} dostępnych</span>
          </div>
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Razem</p>
              <p className="text-3xl font-bold">{formatMoney(totalAmount, currency)}</p>
            </div>
            <Button type="submit" size="lg" disabled={isSubmitting || capacityUnits === 0} className="press-3d min-w-44">
              {isSubmitting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Blokuję bilety…</>
              ) : (
                <><CheckCircle2 className="mr-2 h-4 w-4" /> Zablokuj na 15 minut</>
              )}
            </Button>
          </div>
          <div className="flex items-start gap-2 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            Miejsca zostaną zablokowane dopiero po poprawnym utworzeniu całego zamówienia.
          </div>
        </CardContent>
      </Card>
    </form>
  )
}
