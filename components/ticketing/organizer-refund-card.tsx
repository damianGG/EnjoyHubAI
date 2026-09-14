import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { requestOrderRefund } from "@/app/host/sprzedaz/zamowienie/[orderId]/actions"
import { createClient } from "@/lib/supabase/server"
import { formatMoney } from "@/lib/ticketing/format"

interface RefundRow {
  id: string
  amount_minor: number | string
  currency: string
  status: string
  recovery_status: string
  reason: string
  failure_code: string | null
  created_at: string
  completed_at: string | null
}

export async function OrganizerRefundCard({
  orderId,
  paymentStatus,
  orderTotal,
  currency,
  timezone,
  feedback,
}: {
  orderId: string
  paymentStatus: string
  orderTotal: number
  currency: string
  timezone: string
  feedback?: { status?: string; blad?: string }
}) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("payment_refunds")
    .select("id, amount_minor, currency, status, recovery_status, reason, failure_code, created_at, completed_at")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false })

  const refunds = error ? [] : (data ?? []) as RefundRow[]
  const succeededMinor = refunds
    .filter((refund) => refund.status === "succeeded")
    .reduce((sum, refund) => sum + Number(refund.amount_minor), 0)
  const orderTotalMinor = Math.round(orderTotal * 100)
  const remainingMinor = Math.max(orderTotalMinor - succeededMinor, 0)
  const canRefund = ["paid", "partially_refunded"].includes(paymentStatus) && remainingMinor > 0

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Zwroty</CardTitle>
            <CardDescription className="mt-1">
              Pełny lub częściowy refund do tej samej płatności Stripe.
            </CardDescription>
          </div>
          <Badge variant="secondary">
            Zwrócono {formatMoney(succeededMinor / 100, currency)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {feedback?.status === "zwrot" ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            Zwrot został przekazany do Stripe. Aktualny status jest zapisany w historii poniżej.
          </div>
        ) : null}
        {feedback?.blad ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            {refundErrorMessage(feedback.blad)}
          </div>
        ) : null}

        {canRefund ? (
          <form action={requestOrderRefund} className="space-y-4 rounded-xl border bg-muted/20 p-4">
            <input type="hidden" name="orderId" value={orderId} />
            <div>
              <label htmlFor={`refund-amount-${orderId}`} className="text-sm font-medium">
                Kwota zwrotu
              </label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  id={`refund-amount-${orderId}`}
                  name="amount"
                  type="text"
                  inputMode="decimal"
                  defaultValue={(remainingMinor / 100).toFixed(2)}
                  required
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                />
                <span className="text-sm font-medium text-muted-foreground">{currency}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Pozostało do zwrotu: {formatMoney(remainingMinor / 100, currency)}.
              </p>
            </div>

            <div>
              <label htmlFor={`refund-reason-${orderId}`} className="text-sm font-medium">
                Powód
              </label>
              <textarea
                id={`refund-reason-${orderId}`}
                name="reason"
                required
                minLength={3}
                maxLength={500}
                defaultValue="Zwrot na prośbę klienta"
                className="mt-1 min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div className="rounded-lg bg-background p-3 text-xs text-muted-foreground">
              Pełny zwrot unieważni niewykorzystane bilety. Przy zwrocie częściowym bilety pozostają ważne.
              Jeżeli udział organizatora został już przekazany przez Stripe Connect, EnjoyHub spróbuje automatycznie odwrócić odpowiednią część transferu.
            </div>

            <Button type="submit" variant="destructive">Wykonaj zwrot</Button>
          </form>
        ) : (
          <div className="rounded-lg border px-4 py-3 text-sm text-muted-foreground">
            {remainingMinor <= 0
              ? "Cała zapłacona kwota została już zwrócona."
              : "Zwrot można wykonać dopiero dla potwierdzonej płatności."}
          </div>
        )}

        {refunds.length ? (
          <div>
            <h3 className="text-sm font-semibold">Historia zwrotów</h3>
            <div className="mt-2 divide-y rounded-xl border px-4">
              {refunds.map((refund) => (
                <div key={refund.id} className="py-3 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{formatMoney(Number(refund.amount_minor) / 100, refund.currency)}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatDateTime(refund.created_at, timezone)} · {refund.reason}
                      </p>
                      {refund.failure_code ? (
                        <p className="mt-1 text-xs text-red-700">{refund.failure_code}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={refund.status === "succeeded" ? "default" : refund.status === "failed" ? "destructive" : "secondary"}>
                        {refundStatusLabel(refund.status)}
                      </Badge>
                      {refund.status === "succeeded" && refund.recovery_status !== "not_required" ? (
                        <Badge variant={refund.recovery_status === "reversed" ? "outline" : refund.recovery_status === "debt" || refund.recovery_status === "requires_review" ? "destructive" : "secondary"}>
                          {recoveryStatusLabel(refund.recovery_status)}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function refundStatusLabel(status: string) {
  const labels: Record<string, string> = {
    creating: "Tworzenie",
    pending: "W toku",
    succeeded: "Zwrócono",
    failed: "Nieudany",
    cancelled: "Anulowany",
  }
  return labels[status] ?? status
}

function recoveryStatusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: "Odzyskanie udziału w toku",
    reversed: "Udział organizatora odzyskany",
    debt: "Saldo organizatora do odzyskania",
    requires_review: "Rozliczenie do sprawdzenia",
  }
  return labels[status] ?? status
}

function refundErrorMessage(code: string) {
  if (code === "stripe") return "Stripe nie jest jeszcze skonfigurowany do wykonania realnego zwrotu."
  if (code === "uprawnienia") return "Zwrot może wykonać tylko właściciel lub administrator organizacji."
  if (code === "dane-zwrotu") return "Sprawdź kwotę i powód zwrotu."
  if (code === "provider") return "Stripe nie potwierdził zwrotu. Operacja została zabezpieczona przed podwójnym wykonaniem."
  return "Nie udało się przygotować zwrotu. Odśwież zamówienie i spróbuj ponownie."
}

function formatDateTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat("pl-PL", {
    timeZone: timezone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}
