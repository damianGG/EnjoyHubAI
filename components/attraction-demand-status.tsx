"use client"

import { useSearchParams } from "next/navigation"

export function AttractionDemandStatus() {
  const searchParams = useSearchParams()
  const success = searchParams.get("zainteresowanie") === "1"
  const error = searchParams.get("blad_zainteresowania") === "1"

  if (success) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
        <p className="font-semibold">Zapisaliśmy Twoje zainteresowanie.</p>
        <p className="mt-1">Nie pobieramy żadnej opłaty. Gdy rezerwacja przez EnjoyHub będzie dostępna, będziemy mogli Cię o tym poinformować.</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        Nie udało się zapisać zainteresowania. Sprawdź adres e-mail, termin i liczbę osób.
      </div>
    )
  }

  return null
}
