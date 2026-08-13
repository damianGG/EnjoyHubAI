"use client"

import { useState } from "react"
import { CheckCircle2, Loader2, RefreshCw, ShieldAlert, TicketCheck } from "lucide-react"
import { useRouter } from "next/navigation"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

interface RedemptionResult {
  status: string
  usedAt: string
  alreadyUsed: boolean
  productName: string
  ticketTypeName: string
  venueName: string
}

export function RedeemTicketButton({ ticketCode }: { ticketCode: string }) {
  const router = useRouter()
  const [isRedeeming, setIsRedeeming] = useState(false)
  const [result, setResult] = useState<RedemptionResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function redeemTicket() {
    setIsRedeeming(true)
    setError(null)

    try {
      const response = await fetch("/api/ticketing/tickets/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketCode }),
      })
      const payload = await response.json() as RedemptionResult & { error?: string }

      if (!response.ok) {
        setError(payload.error || "Nie udało się wykorzystać biletu.")
        return
      }

      setResult(payload)
    } catch {
      setError("Brak połączenia. Sprawdź internet i spróbuj ponownie.")
    } finally {
      setIsRedeeming(false)
    }
  }

  if (result) {
    return (
      <div className="space-y-3">
        <Alert
          className={result.alreadyUsed
            ? "border-amber-300 bg-amber-50 text-amber-950"
            : "border-emerald-300 bg-emerald-50 text-emerald-950"}
        >
          {result.alreadyUsed
            ? <ShieldAlert className="h-4 w-4" />
            : <CheckCircle2 className="h-4 w-4" />}
          <AlertTitle>
            {result.alreadyUsed ? "Bilet był już wykorzystany" : "Gość może wejść"}
          </AlertTitle>
          <AlertDescription className="text-current/80">
            {result.alreadyUsed
              ? `Pierwsze użycie: ${formatUsedAt(result.usedAt)}.`
              : `Wejście zapisane: ${formatUsedAt(result.usedAt)}.`}
          </AlertDescription>
        </Alert>
        <Button type="button" variant="outline" className="w-full" onClick={() => router.refresh()}>
          <RefreshCw className="mr-2 h-4 w-4" /> Odśwież status biletu
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button
        type="button"
        size="lg"
        className="w-full bg-emerald-700 hover:bg-emerald-800"
        onClick={redeemTicket}
        disabled={isRedeeming}
      >
        {isRedeeming
          ? <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          : <TicketCheck className="mr-2 h-5 w-5" />}
        {isRedeeming ? "Sprawdzam bilet…" : "Wpuść gościa i wykorzystaj bilet"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Operacja jest zapisywana atomowo i nie może wykorzystać biletu drugi raz.
      </p>
    </div>
  )
}

function formatUsedAt(value: string) {
  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date(value))
}
