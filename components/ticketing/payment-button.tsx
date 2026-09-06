"use client"

import { useState } from "react"
import { CreditCard, Loader2, LockKeyhole } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

export function PaymentButton({ orderId }: { orderId: string }) {
  const [isStarting, setIsStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function startPayment() {
    setIsStarting(true)
    setError(null)

    try {
      const response = await fetch(`/api/ticketing/orders/${orderId}/payment`, { method: "POST" })
      const result = await response.json() as { url?: string; error?: string }

      if (!response.ok || !result.url) {
        setError(result.error || "Nie udało się rozpocząć płatności.")
        return
      }

      window.location.assign(result.url)
    } catch {
      setError("Brak połączenia z operatorem płatności. Spróbuj ponownie.")
    } finally {
      setIsStarting(false)
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <Alert variant="destructive" role="alert" className="rounded-xl">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button
        type="button"
        size="lg"
        className="press-3d h-12 w-full rounded-xl bg-[#ff5a1f] font-semibold text-white hover:bg-[#e94f18]"
        onClick={startPayment}
        disabled={isStarting}
      >
        {isStarting
          ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          : <CreditCard className="mr-2 h-4 w-4" />}
        {isStarting ? "Otwieram płatność…" : "Zapłać bezpiecznie"}
      </Button>
      <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
        <LockKeyhole className="h-3.5 w-3.5" />Płatność obsługuje Stripe.
      </p>
    </div>
  )
}
