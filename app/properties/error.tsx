"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertCircle } from "lucide-react"
import { useEffect } from "react"

export default function PropertiesError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Properties page error:', error)
  }, [error])

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="border-destructive">
        <CardContent className="text-center py-12">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <h3 className="text-lg font-semibold mb-2 text-destructive">Wystąpił błąd</h3>
          <p className="text-muted-foreground mb-4">
            Nie udało się załadować listy nieruchomości. Spróbuj ponownie.
          </p>
          <Button onClick={reset}>Spróbuj ponownie</Button>
        </CardContent>
      </Card>
    </div>
  )
}
