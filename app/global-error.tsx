"use client"

import { useEffect } from "react"
import * as Sentry from "@sentry/nextjs"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="pl">
      <body>
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, fontFamily: "system-ui, sans-serif" }}>
          <div style={{ maxWidth: 520, textAlign: "center" }}>
            <h1 style={{ fontSize: 28, marginBottom: 12 }}>Coś poszło nie tak</h1>
            <p style={{ color: "#667085", lineHeight: 1.6, marginBottom: 20 }}>
              Błąd został zapisany w monitoringu EnjoyHub. Spróbuj ponownie za chwilę.
            </p>
            <button
              type="button"
              onClick={reset}
              style={{ border: 0, borderRadius: 10, padding: "12px 18px", fontWeight: 700, cursor: "pointer", background: "#ff5a1f", color: "white" }}
            >
              Spróbuj ponownie
            </button>
          </div>
        </main>
      </body>
    </html>
  )
}
