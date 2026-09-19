import Link from "next/link"
import { ArrowLeft, MessageCircle } from "lucide-react"
import { redirect } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

interface ConversationRow {
  id: string
  venue_name: string
  organization_name: string
  attraction_title: string | null
  order_number: number | null
  last_message_at: string
}

interface MessageRow {
  conversation_id: string
  sender_user_id: string
  body: string
  read_at: string | null
  created_at: string
}

export default async function CustomerMessagesPage() {
  if (!isSupabaseConfigured) redirect("/")

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login?next=/dashboard/messages")

  const { data, error } = await supabase
    .from("marketplace_conversations")
    .select("id, venue_name, organization_name, attraction_title, order_number, last_message_at")
    .eq("customer_user_id", user.id)
    .order("last_message_at", { ascending: false })

  if (error) {
    return <CenteredMessage>Nie udało się pobrać wiadomości.</CenteredMessage>
  }

  const conversations = (data ?? []) as ConversationRow[]
  const ids = conversations.map((conversation) => conversation.id)

  let messages: MessageRow[] = []
  if (ids.length > 0) {
    const { data: messageData } = await supabase
      .from("marketplace_messages")
      .select("conversation_id, sender_user_id, body, read_at, created_at")
      .in("conversation_id", ids)
      .order("created_at", { ascending: false })
      .limit(500)

    messages = (messageData ?? []) as MessageRow[]
  }

  const latestByConversation = new Map<string, MessageRow>()
  const unreadByConversation = new Map<string, number>()

  for (const message of messages) {
    if (!latestByConversation.has(message.conversation_id)) {
      latestByConversation.set(message.conversation_id, message)
    }
    if (message.sender_user_id !== user.id && !message.read_at) {
      unreadByConversation.set(
        message.conversation_id,
        (unreadByConversation.get(message.conversation_id) ?? 0) + 1,
      )
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Mój panel
        </Link>

        <div className="mb-7 mt-5">
          <h1 className="flex items-center gap-2 text-3xl font-bold">
            <MessageCircle className="h-7 w-7" /> Moje wiadomości
          </h1>
          <p className="mt-2 text-muted-foreground">
            Ustalenia z organizatorami dotyczące atrakcji i rezerwacji.
          </p>
        </div>

        {conversations.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-14 text-center">
              <MessageCircle className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <p className="font-semibold">Nie masz jeszcze żadnych rozmów</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Rozmowę możesz rozpocząć przy swojej rezerwacji.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {conversations.map((conversation) => {
              const latest = latestByConversation.get(conversation.id)
              const unread = unreadByConversation.get(conversation.id) ?? 0
              return (
                <Link key={conversation.id} href={`/messages/${conversation.id}`}>
                  <Card className="transition hover:border-primary/30 hover:bg-muted/20">
                    <CardContent className="flex items-start gap-4 p-4 sm:p-5">
                      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                        <MessageCircle className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-semibold">{conversation.venue_name}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {conversation.attraction_title || conversation.organization_name}
                              {conversation.order_number ? ` · Rezerwacja #${conversation.order_number}` : ""}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            {unread > 0 ? <Badge>{unread}</Badge> : null}
                            <span className="text-xs text-muted-foreground">
                              {formatInboxDate(conversation.last_message_at)}
                            </span>
                          </div>
                        </div>
                        <p className="mt-2 truncate text-sm text-muted-foreground">
                          {latest?.body || "Rozmowa utworzona — napisz pierwszą wiadomość."}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}

function formatInboxDate(value: string) {
  return new Intl.DateTimeFormat("pl-PL", {
    timeZone: "Europe/Warsaw",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return <main className="flex min-h-screen items-center justify-center px-4 text-muted-foreground">{children}</main>
}
