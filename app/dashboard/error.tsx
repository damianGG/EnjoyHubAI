"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { AlertCircle } from "lucide-react"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Dashboard error:", error)
  }, [error])

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <div className="text-center max-w-md">
        <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">Błąd w panelu użytkownika</h2>
        <p className="text-muted-foreground mb-6">
          Nie udało się załadować panelu użytkownika. Sprawdź swoje połączenie i spróbuj ponownie.
        </p>
        <div className="space-x-4">
          <Button onClick={() => reset()}>
            Spróbuj ponownie
          </Button>
          <Button variant="outline" onClick={() => window.location.href = "/"}>
            Wróć do strony głównej
          </Button>
        </div>
      </div>
    </div>
  )
}
