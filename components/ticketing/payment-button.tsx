"use client"

import { useState } from "react"
import { CreditCard, Loader2 } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

export function PaymentButton({ orderId }: { orderId: string }) {
  const [isStarting, setIsStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function startPayment() {
    setIsStarting(true)
    setError(null)

    try {
      const response = await fetch(`/api/ticketing/orders/${orderId}/payment`, {
        method: "POST",
      })
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
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button
        type="button"
        size="lg"
        className="press-3d w-full"
        onClick={startPayment}
        disabled={isStarting}
      >
        {isStarting
          ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          : <CreditCard className="mr-2 h-4 w-4" />}
        {isStarting ? "Otwieram bezpieczną płatność…" : "Przejdź do płatności"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Płatność obsługuje Stripe. Dostępne metody zależą od konfiguracji konta.
      </p>
    </div>
  )
}
