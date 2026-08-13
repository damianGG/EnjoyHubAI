"use client"

import { FormEvent, useState } from "react"
import { CheckCircle2, Loader2, Search, ShieldAlert } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface RedemptionResult {
  ticketCode: string
  usedAt: string
  alreadyUsed: boolean
  productName: string
  ticketTypeName: string
  venueName: string
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function ManualTicketRedeemer() {
  const [value, setValue] = useState("")
  const [isRedeeming, setIsRedeeming] = useState(false)
  const [result, setResult] = useState<RedemptionResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const ticketCode = extractTicketCode(value)

    if (!ticketCode) {
      setResult(null)
      setError("Wpisz kod UUID biletu albo wklej pełny adres biletu.")
      return
    }

    setIsRedeeming(true)
    setResult(null)
    setError(null)

    try {
      const response = await fetch("/api/ticketing/tickets/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketCode }),
      })
      const payload = await response.json() as RedemptionResult & { error?: string }

      if (!response.ok) {
        setError(payload.error || "Nie udało się sprawdzić biletu.")
        return
      }

      setResult(payload)
    } catch {
      setError("Brak połączenia. Sprawdź internet i spróbuj ponownie.")
    } finally {
      setIsRedeeming(false)
    }
  }

  return (
    <div className="space-y-5">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <Label htmlFor="ticket-code">Kod lub adres biletu</Label>
          <Input
            id="ticket-code"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>
        <Button type="submit" className="w-full" disabled={isRedeeming}>
          {isRedeeming
            ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            : <Search className="mr-2 h-4 w-4" />}
          {isRedeeming ? "Sprawdzam…" : "Sprawdź i wykorzystaj"}
        </Button>
      </form>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {result && (
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
            <p>{result.productName} · {result.ticketTypeName}</p>
            <p>{result.venueName}</p>
            <p>{result.alreadyUsed ? "Pierwsze użycie" : "Wejście zapisane"}: {formatUsedAt(result.usedAt)}</p>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}

function extractTicketCode(value: string) {
  const trimmed = value.trim()
  if (uuidPattern.test(trimmed)) return trimmed.toLowerCase()

  try {
    const url = new URL(trimmed)
    const segments = url.pathname.split("/").filter(Boolean)
    const ticketIndex = segments.lastIndexOf("bilet")
    const candidate = ticketIndex >= 0 ? segments[ticketIndex + 1] : undefined
    return candidate && uuidPattern.test(candidate) ? candidate.toLowerCase() : null
  } catch {
    return null
  }
}

function formatUsedAt(value: string) {
  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date(value))
}
