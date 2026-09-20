"use client"

import { useMemo, useRef, useState } from "react"
import type { FormEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowRight, Building2, Loader2, Minus, Plus, RotateCcw, ShieldCheck, Tag, Ticket, UserRound } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { formatMoney } from "@/lib/ticketing/format"
import type { CheckoutOrderResult, TicketingCheckoutSession } from "@/lib/ticketing/types"

interface CheckoutLegalContext {
  termsVersion: string
  cancellationPolicyVersion: string
  seller: {
    legal_name: string
    tax_id: string
    email: string
    legal_address: string
    contact_phone: string
    registry_name: string | null
    registry_number: string | null
  }
  cancellationPolicy: {
    title: string
    shortSummary: string
    statutoryWithdrawalNotice: string
  }
  platform: {
    legal_name: string
    responsibility: string
  }
  platformContactConfigured: boolean
  sellerVerified: boolean
}

interface CheckoutFormProps {
  session: TicketingCheckoutSession
  legalContext: CheckoutLegalContext
}

interface PromotionQuote {
  promotionId: string
  code: string
  name: string
  kind: "promotion" | "voucher"
  discountType: "percentage" | "fixed"
  subtotalAmount: number
  discountAmount: number
  totalAmount: number
  currency: string
}

export function CheckoutForm({ session, legalContext }: CheckoutFormProps) {
  const router = useRouter()
  const checkoutKey = useRef<string | null>(null)
  const formRef = useRef<HTMLFormElement | null>(null)
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [promotionCode, setPromotionCode] = useState("")
  const [promotionQuote, setPromotionQuote] = useState<PromotionQuote | null>(null)
  const [promotionLoading, setPromotionLoading] = useState(false)
  const [promotionError, setPromotionError] = useState<string | null>(null)

  const selected = useMemo(() => session.ticketTypes.flatMap((ticket) => {
    const quantity = quantities[ticket.id] ?? 0
    return quantity > 0 ? [{ ticket, quantity }] : []
  }), [quantities, session.ticketTypes])

  const subtotalAmount = selected.reduce((sum, item) => sum + item.ticket.priceAmount * item.quantity, 0)
  const finalAmount = promotionQuote?.totalAmount ?? subtotalAmount
  const capacityUnits = selected.reduce((sum, item) => sum + item.ticket.capacityUnits * item.quantity, 0)
  const currency = session.ticketTypes[0]?.currency ?? "PLN"

  function changeQuantity(ticketId: string, direction: 1 | -1) {
    const ticket = session.ticketTypes.find((item) => item.id === ticketId)
    if (!ticket) return

    setError(null)
    setPromotionQuote(null)
    setPromotionError(null)
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

  async function applyPromotionCode() {
    setPromotionError(null)
    setPromotionQuote(null)

    const code = promotionCode.trim()
    if (code.length < 3) {
      setPromotionError("Wpisz kod promocji lub vouchera.")
      return
    }
    if (!selected.length) {
      setPromotionError("Najpierw wybierz bilety.")
      return
    }

    const form = formRef.current
    const formData = form ? new FormData(form) : null
    const customerEmail = String(formData?.get("customerEmail") ?? "").trim()
    setPromotionLoading(true)

    try {
      const response = await fetch("/api/ticketing/promotions/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          code,
          customerEmail: customerEmail || null,
          items: selected.map(({ ticket, quantity }) => ({
            ticketTypeId: ticket.id,
            quantity,
          })),
        }),
      })

      const result = await response.json() as PromotionQuote & { error?: string }
      if (!response.ok) {
        setPromotionError(result.error || "Nie udało się zastosować kodu.")
        return
      }

      setPromotionCode(result.code)
      setPromotionQuote(result)
    } catch {
      setPromotionError("Nie udało się sprawdzić kodu. Spróbuj ponownie.")
    } finally {
      setPromotionLoading(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (capacityUnits < session.product.minParticipants) {
      setError(`Wybierz bilety dla co najmniej ${session.product.minParticipants} osób.`)
      return
    }

    if (!termsAccepted) {
      setError("Zaakceptuj regulamin i zasady anulowania, aby przejść do płatności.")
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
          termsVersion: legalContext.termsVersion,
          cancellationPolicyVersion: legalContext.cancellationPolicyVersion,
          promotionCode: promotionQuote?.code ?? null,
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
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
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
                    <Button type="button" variant="ghost" size="icon" onClick={() => changeQuantity(ticket.id, -1)} disabled={quantity === 0 || isSubmitting} className="h-9 w-9 rounded-full bg-white shadow-sm" aria-label={`Usuń bilet ${ticket.name}`}>
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-7 text-center text-base font-bold" aria-live="polite">{quantity}</span>
                    <Button type="button" variant="ghost" size="icon" onClick={() => changeQuantity(ticket.id, 1)} disabled={!canAdd || isSubmitting} className="h-9 w-9 rounded-full bg-[#ff5a1f] text-white shadow-sm hover:bg-[#e94f18] hover:text-white" aria-label={`Dodaj bilet ${ticket.name}`}>
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
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#fff1eb] text-[#ff5a1f]"><Tag className="h-5 w-5" /></span>
            <div>
              <p className="font-bold">Kod promocji lub voucher</p>
              <p className="text-xs text-muted-foreground">Opcjonalnie — rabat przeliczymy przed utworzeniem rezerwacji.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Input
              value={promotionCode}
              onChange={(event) => {
                setPromotionCode(event.target.value.toUpperCase())
                setPromotionQuote(null)
                setPromotionError(null)
              }}
              maxLength={32}
              placeholder="np. LATO20"
              className="h-11 rounded-xl uppercase"
              disabled={promotionLoading || isSubmitting}
            />
            <Button type="button" variant="outline" onClick={applyPromotionCode} disabled={promotionLoading || isSubmitting || !selected.length}>
              {promotionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Zastosuj"}
            </Button>
          </div>
          {promotionQuote && (
            <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
              <p className="font-semibold">{promotionQuote.name} · kod {promotionQuote.code}</p>
              <p className="mt-1">Rabat: {formatMoney(promotionQuote.discountAmount, promotionQuote.currency)}</p>
            </div>
          )}
          {promotionError && <p className="mt-2 text-sm text-red-700">{promotionError}</p>}
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
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-0 bg-white shadow-sm ring-1 ring-black/5">
        <CardContent className="space-y-4 p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Building2 className="h-5 w-5" /></span>
            <div>
              <p className="font-bold">Kto sprzedaje usługę</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Sprzedawcą i wykonawcą atrakcji jest organizator poniżej. EnjoyHub prowadzi marketplace i obsługuje proces rezerwacji oraz płatności.</p>
            </div>
          </div>
          <div className="rounded-2xl border bg-muted/20 p-4 text-sm leading-6">
            <p className="font-semibold">{legalContext.seller.legal_name}</p>
            <p className="mt-1 text-muted-foreground">NIP {legalContext.seller.tax_id}{legalContext.seller.registry_name && legalContext.seller.registry_number ? ` · ${legalContext.seller.registry_name} ${legalContext.seller.registry_number}` : ""}</p>
            <p className="text-muted-foreground">{legalContext.seller.legal_address}</p>
            <p className="text-muted-foreground">{legalContext.seller.email} · {legalContext.seller.contact_phone}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-0 bg-white shadow-sm ring-1 ring-black/5">
        <CardContent className="space-y-4 p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><RotateCcw className="h-5 w-5" /></span>
            <div>
              <p className="font-bold">{legalContext.cancellationPolicy.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{legalContext.cancellationPolicy.shortSummary}</p>
            </div>
          </div>
          <p className="rounded-2xl bg-amber-50 p-4 text-xs leading-relaxed text-amber-900">{legalContext.cancellationPolicy.statutoryWithdrawalNotice}</p>
          <Link href="/zasady-anulowania" target="_blank" className="inline-flex text-sm font-semibold text-primary hover:underline">Pełne zasady anulowania i zwrotów ↗</Link>
        </CardContent>
      </Card>

      {!legalContext.platformContactConfigured && (
        <Alert>
          <AlertDescription>Płatność online dla tej rezerwacji jest chwilowo niedostępna. Możesz wrócić do atrakcji i wybrać inny termin lub spróbować ponownie później.</AlertDescription>
        </Alert>
      )}

      <Card className="rounded-3xl border-0 bg-white shadow-sm ring-1 ring-black/5">
        <CardContent className="p-5">
          <label htmlFor="termsAccepted" className="flex cursor-pointer items-start gap-3 rounded-2xl border bg-muted/20 p-4">
            <Checkbox id="termsAccepted" checked={termsAccepted} onCheckedChange={(checked) => setTermsAccepted(checked === true)} className="mt-0.5" required />
            <span className="text-sm leading-relaxed">
              Akceptuję <Link href="/regulamin" target="_blank" className="font-semibold text-primary underline" onClick={(event) => event.stopPropagation()}>Regulamin EnjoyHub</Link> oraz <Link href="/zasady-anulowania" target="_blank" className="font-semibold text-primary underline" onClick={(event) => event.stopPropagation()}>zasady anulowania i zwrotów</Link> obowiązujące dla tej rezerwacji. Rozumiem, że sprzedawcą usługi jest wskazany wyżej organizator.
            </span>
          </label>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Regulamin: {legalContext.termsVersion} · Zasady anulowania: {legalContext.cancellationPolicyVersion}. Wersje zaakceptowane przy zakupie zostaną zapisane przy zamówieniu.</p>
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
            {promotionQuote && <p className="text-xs text-muted-foreground line-through">{formatMoney(subtotalAmount, currency)}</p>}
            <p className="text-2xl font-black">{formatMoney(finalAmount, currency)}</p>
          </div>
          <Button type="submit" size="lg" disabled={isSubmitting || capacityUnits === 0} className="h-12 flex-1 rounded-xl bg-[#ff5a1f] font-semibold text-white hover:bg-[#e94f18] sm:max-w-xs">
            {isSubmitting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Rezerwuję…</>
            ) : (
              <>{finalAmount === 0 ? "Potwierdzam rezerwację" : "Kupuję i płacę"}<ArrowRight className="ml-2 h-4 w-4" /></>
            )}
          </Button>
        </div>
        <div className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
          {finalAmount === 0
            ? "Kod pokrywa całą wartość zamówienia. Po potwierdzeniu miejsca zostaną od razu zarezerwowane i wystawimy bilety."
            : "Kliknięcie „Kupuję i płacę” oznacza złożenie zamówienia z obowiązkiem zapłaty. Miejsca zostaną zablokowane na 15 minut, a następnie przejdziesz do operatora płatności."}
        </div>
      </div>
    </form>
  )
}
