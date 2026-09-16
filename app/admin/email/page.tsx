import Link from "next/link"

import { AlertTriangle, CheckCircle2, Clock3, Mail, RefreshCw, Send, XCircle } from "lucide-react"

import { resendEmailAction } from "@/app/admin/email/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { requirePlatformStaff } from "@/lib/platform-admin/access"
import { createAdminClient } from "@/lib/supabase/admin"

const statusFilters = ["all", "pending", "processing", "sent", "failed"] as const
type StatusFilter = (typeof statusFilters)[number]

type EmailOutboxRow = {
  id: string
  status: "pending" | "processing" | "sent" | "failed"
  email_type: string
  to_addresses: string[]
  subject: string
  source_type: string | null
  source_id: string | null
  attempt_count: number
  max_attempts: number
  next_attempt_at: string | null
  provider_message_id: string | null
  last_error: string | null
  sent_at: string | null
  failed_at: string | null
  created_at: string
  resend_of_id: string | null
}

function formatDate(value: string | null) {
  if (!value) return "—"
  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "Europe/Warsaw",
  }).format(new Date(value))
}

function statusLabel(status: EmailOutboxRow["status"]) {
  switch (status) {
    case "pending": return "Oczekuje"
    case "processing": return "Wysyłanie"
    case "sent": return "Wysłano"
    case "failed": return "Błąd"
  }
}

function statusVariant(status: EmailOutboxRow["status"]): "default" | "secondary" | "destructive" | "outline" {
  if (status === "sent") return "default"
  if (status === "failed") return "destructive"
  if (status === "processing") return "secondary"
  return "outline"
}

export default async function EmailOutboxAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; ponowiono?: string; wyslano?: string; blad?: string }>
}) {
  await requirePlatformStaff(["platform_superadmin", "platform_support"], "/admin/email")
  const params = await searchParams
  const status: StatusFilter = statusFilters.includes(params.status as StatusFilter)
    ? params.status as StatusFilter
    : "all"

  const admin = createAdminClient()
  let query = admin
    .from("email_outbox")
    .select("id, status, email_type, to_addresses, subject, source_type, source_id, attempt_count, max_attempts, next_attempt_at, provider_message_id, last_error, sent_at, failed_at, created_at, resend_of_id")
    .order("created_at", { ascending: false })
    .limit(100)

  if (status !== "all") query = query.eq("status", status)

  const [rowsResult, pendingResult, processingResult, sentResult, failedResult] = await Promise.all([
    query,
    admin.from("email_outbox").select("id", { count: "exact", head: true }).eq("status", "pending"),
    admin.from("email_outbox").select("id", { count: "exact", head: true }).eq("status", "processing"),
    admin.from("email_outbox").select("id", { count: "exact", head: true }).eq("status", "sent"),
    admin.from("email_outbox").select("id", { count: "exact", head: true }).eq("status", "failed"),
  ])

  if (rowsResult.error) {
    console.error("Email outbox admin list failed", { message: rowsResult.error.message })
  }

  const rows = (rowsResult.data ?? []) as EmailOutboxRow[]
  const stats = {
    pending: pendingResult.count ?? 0,
    processing: processingResult.count ?? 0,
    sent: sentResult.count ?? 0,
    failed: failedResult.count ?? 0,
  }

  return (
    <main className="container mx-auto space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold"><Mail className="h-6 w-6" /> E-maile transakcyjne</h1>
          <p className="mt-1 text-sm text-muted-foreground">Centralny outbox EnjoyHub. Wiadomości są zapisywane przed wysyłką i automatycznie ponawiane po chwilowych błędach.</p>
        </div>
        <Button asChild variant="outline"><Link href="/admin/email">Odśwież</Link></Button>
      </div>

      {params.ponowiono === "1" && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
          {params.wyslano === "1" ? "Wiadomość została ponownie wysłana." : "Ponowna wysyłka została dodana do kolejki."}
        </div>
      )}
      {params.blad && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-950">Nie udało się utworzyć ponownej wysyłki. Sprawdź wpis i spróbuj ponownie.</div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Oczekujące" value={stats.pending} icon={Clock3} />
        <MetricCard label="Wysyłane" value={stats.processing} icon={Send} />
        <MetricCard label="Wysłane" value={stats.sent} icon={CheckCircle2} />
        <MetricCard label="Po błędzie" value={stats.failed} icon={XCircle} />
      </div>

      <div className="flex flex-wrap gap-2">
        {statusFilters.map((filter) => (
          <Button key={filter} asChild size="sm" variant={filter === status ? "default" : "outline"}>
            <Link href={filter === "all" ? "/admin/email" : `/admin/email?status=${filter}`}>
              {filter === "all" ? "Wszystkie" : statusLabel(filter as EmailOutboxRow["status"])}
            </Link>
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ostatnie wiadomości</CardTitle>
          <CardDescription>Maksymalnie 100 najnowszych rekordów dla wybranego filtra. Treść wiadomości nie jest wyświetlana w tabeli.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {rows.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">Brak wiadomości dla wybranego statusu.</div>
          ) : (
            <table className="w-full min-w-[1100px] text-sm">
              <thead className="border-y bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Typ / temat</th>
                  <th className="px-4 py-3">Odbiorca</th>
                  <th className="px-4 py-3">Próby</th>
                  <th className="px-4 py-3">Utworzono / wysłano</th>
                  <th className="px-4 py-3">Provider ID / błąd</th>
                  <th className="px-4 py-3 text-right">Akcja</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b align-top">
                    <td className="px-4 py-4"><Badge variant={statusVariant(row.status)}>{statusLabel(row.status)}</Badge>{row.resend_of_id && <div className="mt-1 text-xs text-muted-foreground">ponowna wysyłka</div>}</td>
                    <td className="max-w-xs px-4 py-4"><div className="font-medium">{row.subject}</div><div className="mt-1 font-mono text-xs text-muted-foreground">{row.email_type}</div>{row.source_type && <div className="mt-1 text-xs text-muted-foreground">{row.source_type}{row.source_id ? ` · ${row.source_id.slice(0, 12)}…` : ""}</div>}</td>
                    <td className="px-4 py-4"><div className="max-w-[240px] break-all">{row.to_addresses.join(", ")}</div></td>
                    <td className="px-4 py-4"><span className="font-medium">{row.attempt_count}</span> / {row.max_attempts}{row.next_attempt_at && row.status === "pending" && <div className="mt-1 text-xs text-muted-foreground">kolejna: {formatDate(row.next_attempt_at)}</div>}</td>
                    <td className="px-4 py-4"><div>{formatDate(row.created_at)}</div>{row.sent_at && <div className="mt-1 text-xs text-emerald-700">wysłano: {formatDate(row.sent_at)}</div>}{row.failed_at && <div className="mt-1 text-xs text-red-700">zakończono: {formatDate(row.failed_at)}</div>}</td>
                    <td className="max-w-sm px-4 py-4">{row.provider_message_id ? <div className="break-all font-mono text-xs">{row.provider_message_id}</div> : <span className="text-muted-foreground">—</span>}{row.last_error && <div className="mt-2 flex gap-1 text-xs text-red-700"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span className="line-clamp-3">{row.last_error}</span></div>}</td>
                    <td className="px-4 py-4 text-right">
                      <form action={resendEmailAction}>
                        <input type="hidden" name="outboxId" value={row.id} />
                        <Button type="submit" size="sm" variant="outline"><RefreshCw className="mr-1.5 h-3.5 w-3.5" />Wyślij ponownie</Button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </main>
  )
}

function MetricCard({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Mail }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-5">
        <div><div className="text-sm text-muted-foreground">{label}</div><div className="mt-1 text-2xl font-semibold">{value}</div></div>
        <Icon className="h-5 w-5 text-muted-foreground" />
      </CardContent>
    </Card>
  )
}
