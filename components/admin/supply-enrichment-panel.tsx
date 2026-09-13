"use client"

import { useState } from "react"
import { BrainCircuit, Check, ExternalLink, Loader2, RefreshCw, X } from "lucide-react"
import { useRouter } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type EnrichmentData = {
  completeness?: number
  definitions?: any[]
  attributeValues?: any[]
  externalSignals?: any[]
  runs?: any[]
  suggestions?: any[]
}

export function SupplyEnrichmentPanel({ leadId, enrichment }: { leadId: string; enrichment: EnrichmentData }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [activeSuggestion, setActiveSuggestion] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const completeness = Number(enrichment?.completeness || 0)
  const pending = (enrichment?.suggestions || []).filter((item: any) => item.status === "pending")
  const reviewed = (enrichment?.suggestions || []).filter((item: any) => item.status !== "pending")

  async function runEnrichment() {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const response = await fetch(`/api/admin/supply/${leadId}/enrich`, { method: "POST" })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || "Nie udało się uruchomić AI")
      setMessage(`AI zakończyło research. Nowe sugestie: ${result.suggestionCount || 0}.`)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się uruchomić AI")
    } finally {
      setBusy(false)
    }
  }

  async function resolveSuggestion(id: string, decision: "accepted" | "rejected") {
    setActiveSuggestion(id)
    setError(null)
    try {
      const response = await fetch(`/api/admin/supply/${leadId}/enrichment/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || "Nie udało się zapisać decyzji")
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się zapisać decyzji")
    } finally {
      setActiveSuggestion(null)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><BrainCircuit className="h-5 w-5" />AI Enrichment</CardTitle>
            <CardDescription className="mt-2 max-w-2xl">AI przeszukuje internet, ale niczego nie publikuje samodzielnie. Każdy znaleziony fakt trafia niżej jako osobna sugestia ze źródłem i confidence.</CardDescription>
          </div>
          <Button onClick={runEnrichment} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Uzupełnij AI
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Kompletność profilu</p>
              <p className="text-3xl font-bold">{completeness}%</p>
            </div>
            <p className="text-right text-xs text-muted-foreground">Uwzględnia dane podstawowe oraz wymagane atrybuty kategorii.</p>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, Math.max(0, completeness))}%` }} /></div>
          {message && <p className="text-sm text-emerald-700">{message}</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sugestie do zatwierdzenia</CardTitle>
          <CardDescription>{pending.length ? `${pending.length} informacji czeka na decyzję.` : "Brak oczekujących sugestii."}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {pending.map((item: any) => {
            const source = Array.isArray(item.source_urls) ? item.source_urls[0] : null
            return (
              <div key={item.id} className="rounded-xl border p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{targetLabel(item.target_type)}</Badge>
                      <p className="font-semibold">{item.proposed_value?.label || item.target_key}</p>
                      <Badge variant={Number(item.confidence) >= 90 ? "default" : "secondary"}>{Math.round(Number(item.confidence || 0))}% confidence</Badge>
                    </div>
                    <p className="text-sm"><span className="text-muted-foreground">Propozycja: </span>{displayValue(item)}</p>
                    {item.rationale && <p className="text-sm text-muted-foreground">{item.rationale}</p>}
                    {source && <a href={source} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline"><ExternalLink className="h-3 w-3" />Źródło</a>}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" onClick={() => resolveSuggestion(item.id, "accepted")} disabled={activeSuggestion === item.id}><Check className="mr-1 h-4 w-4" />Akceptuj</Button>
                    <Button size="sm" variant="outline" onClick={() => resolveSuggestion(item.id, "rejected")} disabled={activeSuggestion === item.id}><X className="mr-1 h-4 w-4" />Odrzuć</Button>
                  </div>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Atrybuty atrakcji</CardTitle><CardDescription>Elastyczne pola charakterystyczne dla kategorii i podkategorii.</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {(enrichment?.attributeValues || []).length ? (enrichment.attributeValues || []).map((item: any) => (
              <div key={item.id} className="flex items-center justify-between gap-4 rounded-lg border px-3 py-2 text-sm"><span>{item.label || item.key}</span><span className="font-medium text-right">{formatJsonValue(item.value)}</span></div>
            )) : <p className="text-sm text-muted-foreground">Brak zatwierdzonych atrybutów.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Oceny zewnętrzne</CardTitle><CardDescription>Każde źródło jest przechowywane oddzielnie od opinii klientów EnjoyHub.</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {(enrichment?.externalSignals || []).length ? (enrichment.externalSignals || []).map((signal: any) => (
              <div key={signal.id} className="rounded-lg border px-3 py-3 text-sm">
                <div className="flex items-center justify-between gap-3"><span className="font-medium capitalize">{signal.provider}</span><span className="font-semibold">{signal.rating ? `${signal.rating} ★` : "—"}{signal.review_count != null ? ` · ${signal.review_count} opinii` : ""}</span></div>
                {signal.source_url && <a href={signal.source_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"><ExternalLink className="h-3 w-3" />Zobacz źródło</a>}
              </div>
            )) : <p className="text-sm text-muted-foreground">Brak zatwierdzonych ocen zewnętrznych.</p>}
          </CardContent>
        </Card>
      </div>

      {reviewed.length > 0 && <p className="text-xs text-muted-foreground">Historia decyzji AI: {reviewed.length} zaakceptowanych lub odrzuconych sugestii.</p>}
    </div>
  )
}

function targetLabel(value: string) {
  return ({ lead_field: "Dane profilu", attribute: "Atrybut", external_signal: "Ocena zewnętrzna" } as Record<string, string>)[value] || value
}

function displayValue(item: any) {
  const value = item.proposed_value || {}
  if (item.target_type === "external_signal") return `${value.provider || item.target_key}: ${value.rating ?? "—"} ★${value.reviewCount != null ? ` (${value.reviewCount})` : ""}`
  if (value.booleanValue != null) return value.booleanValue ? "Tak" : "Nie"
  if (value.numericValue != null) return String(value.numericValue)
  return value.value ?? "—"
}

function formatJsonValue(value: any) {
  if (typeof value === "boolean") return value ? "Tak" : "Nie"
  if (typeof value === "number" || typeof value === "string") return String(value)
  return JSON.stringify(value)
}
