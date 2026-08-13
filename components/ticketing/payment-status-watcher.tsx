"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"

export function PaymentStatusWatcher({ orderId }: { orderId: string }) {
  const router = useRouter()
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    let attempts = 0
    let stopped = false

    async function refreshStatus() {
      attempts += 1
      try {
        const response = await fetch(`/api/ticketing/orders/${orderId}/status`, {
          cache: "no-store",
        })
        if (!response.ok || stopped) return

        const result = await response.json() as {
          orderStatus: string
          paymentStatus: string
        }

        if (
          result.orderStatus === "confirmed" ||
          result.orderStatus === "cancelled" ||
          result.orderStatus === "expired" ||
          result.paymentStatus === "failed"
        ) {
          stopped = true
          router.refresh()
          return
        }
      } finally {
        if (attempts >= 15 && !stopped) {
          stopped = true
          setTimedOut(true)
        }
      }
    }

    void refreshStatus()
    const timer = window.setInterval(() => {
      if (stopped) {
        window.clearInterval(timer)
        return
      }
      void refreshStatus()
    }, 2000)

    return () => {
      stopped = true
      window.clearInterval(timer)
    }
  }, [orderId, router])

  if (timedOut) {
    return (
      <Alert>
        <AlertDescription>
          Potwierdzenie trwa dłużej niż zwykle. Odśwież stronę za chwilę — płatność nie zostanie pobrana drugi raz.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <Alert className="border-blue-200 bg-blue-50 text-blue-950">
      <Loader2 className="h-4 w-4 animate-spin" />
      <AlertDescription>
        Odbieramy bezpieczne potwierdzenie płatności i wystawiamy bilety…
      </AlertDescription>
    </Alert>
  )
}
