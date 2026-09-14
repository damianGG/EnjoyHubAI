"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

import { Button } from "@/components/ui/button"

export function DiscoveryRunner({ campaignId }: { campaignId: string }) {
  const router = useRouter()
  const [batchSize, setBatchSize] = useState("1")
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [message, setMessage] = useState<string | null>(null)

  async function runDiscovery() {
    if (running) return
    const target = Number(batchSize)
    setRunning(true)
    setProgress(0)
    setMessage(null)

    let totalNew = 0
    let totalDuplicates = 0
    let completed = 0

    try {
      for (let index = 0; index < target; index += 1) {
        const response = await fetch(`/api/admin/supply/campaigns/${campaignId}/discover`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        })
        const payload = await response.json().catch(() => ({}))

        if (response.status === 409) {
          setMessage(completed > 0
            ? `Wykonano ${completed} zapytań. Nie ma już kolejnych oczekujących wyszukiwań.`
            : "Nie ma już kolejnych oczekujących wyszukiwań.")
          break
        }

        if (!response.ok) {
          throw new Error(payload?.error || "Nie udało się wykonać Discovery")
        }

        completed += 1
        totalNew += Number(payload?.newLeads || 0)
        totalDuplicates += Number(payload?.duplicates || 0)
        setProgress(completed)
        setMessage(`Ostatnie: ${payload?.query || "wyszukiwanie"} · nowe ${payload?.newLeads || 0} · duplikaty ${payload?.duplicates || 0}`)
      }

      if (completed > 0) {
        setMessage(`Gotowe: ${completed} zapytań · ${totalNew} nowych leadów · ${totalDuplicates} duplikatów.`)
      }
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nieznany błąd Discovery")
      router.refresh()
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="font-medium">Uruchom Discovery</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Każde zapytanie jest wykonywane osobno. Możesz uruchomić serię 1, 5 lub 10 wyszukiwań.
        </p>
        {message && <p className="mt-2 text-sm">{message}</p>}
      </div>
      <div className="flex items-end gap-2">
        <label className="grid gap-1 text-xs text-muted-foreground">
          Liczba zapytań
          <select
            value={batchSize}
            onChange={(event) => setBatchSize(event.target.value)}
            disabled={running}
            className="h-10 rounded-md border bg-background px-3 text-sm text-foreground"
          >
            <option value="1">1</option>
            <option value="5">5</option>
            <option value="10">10</option>
          </select>
        </label>
        <Button type="button" onClick={runDiscovery} disabled={running}>
          {running ? `Discovery ${progress}/${batchSize}` : "Uruchom"}
        </Button>
      </div>
    </div>
  )
}
