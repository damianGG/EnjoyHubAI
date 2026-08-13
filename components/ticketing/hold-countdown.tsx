"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Clock3, Loader2, XCircle } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

interface HoldCountdownProps {
  orderId: string
  expiresAt: string
  initialStatus: string
  initialNow: number
}

export function HoldCountdown({ orderId, expiresAt, initialStatus, initialNow }: HoldCountdownProps) {
  const router = useRouter()
  const [now, setNow] = useState(initialNow)
  const [isReleasing, setIsReleasing] = useState(false)
  const [releaseError, setReleaseError] = useState<string | null>(null)

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const remainingSeconds = Math.max(
    0,
    Math.ceil((new Date(expiresAt).getTime() - now) / 1000),
  )
  const time = useMemo(() => {
    const minutes = Math.floor(remainingSeconds / 60)
    const seconds = remainingSeconds % 60
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
  }, [remainingSeconds])
  const isActive = initialStatus === "active" && remainingSeconds > 0

  async function releaseHold() {
    setIsReleasing(true)
    setReleaseError(null)
    try {
      const response = await fetch(`/api/ticketing/orders/${orderId}/release`, {
        method: "POST",
      })
      const result = await response.json() as { error?: string }
      if (!response.ok) {
        setReleaseError(result.error || "Nie udało się anulować blokady.")
        return
      }
      router.push("/checkout")
      router.refresh()
    } catch {
      setReleaseError("Brak połączenia. Spróbuj ponownie.")
    } finally {
      setIsReleasing(false)
    }
  }

  if (!isActive) {
    return (
      <Alert variant="destructive">
        <Clock3 className="h-4 w-4" />
        <AlertDescription>
          Blokada miejsc wygasła lub została zwolniona. Wybierz termin ponownie.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-center">
        <div className="flex items-center justify-center gap-2 text-sm font-medium text-amber-900">
          <Clock3 className="h-4 w-4" />
          Bilety są zablokowane jeszcze przez
        </div>
        <p className="mt-2 font-mono text-4xl font-bold tabular-nums text-amber-950" aria-live="polite">
          {time}
        </p>
      </div>
      {releaseError && (
        <Alert variant="destructive"><AlertDescription>{releaseError}</AlertDescription></Alert>
      )}
      <Button type="button" variant="outline" className="w-full" onClick={releaseHold} disabled={isReleasing}>
        {isReleasing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
        Anuluj i zwolnij miejsca
      </Button>
    </div>
  )
}
