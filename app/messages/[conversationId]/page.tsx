import Link from "next/link"
import { ArrowLeft, MessageCircle, Ticket } from "lucide-react"
import { notFound, redirect } from "next/navigation"

import { ChatThread, type MarketplaceChatMessage } from "@/components/messaging/chat-thread"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

interface ConversationPageProps {
  params: Promise<{ conversationId: string }>
}

interface ConversationRecord {
  id: string
  customer_user_id: string
  organization_id: string
  venue_id: string
  attraction_id: string | null
  order_id: string | null
  order_number: number | null
  customer_name: string
  organization_name: string
  venue_name: string
  attraction_title: string | null
}

export default async function ConversationPage({ params }: ConversationPageProps) {
  if (!isSupabaseConfigured) redirect("/")

  const { conversationId } = await params
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/auth/login?next=/messages/${conversationId}`)

  const { data, error } = await supabase
    .from("marketplace_conversations")
    .select("id, customer_user_id, organization_id, venue_id, attraction_id, order_id, order_number, customer_name, organization_name, venue_name, attraction_title")
    .eq("id", conversationId)
    .maybeSingle()

  if (error || !data) notFound()

  const conversation = data as ConversationRecord
  const isCustomer = conversation.customer_user_id === user.id

  const [{ data: messages }, markReadResult] = await Promise.all([
    supabase
      .from("marketplace_messages")
      .select("id, conversation_id, sender_user_id, body, read_at, created_at")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: true }),
    supabase.rpc("marketplace_mark_conversation_read", {
      p_conversation_id: conversation.id,
    }),
  ])

  void markReadResult

  return (
    <main className="min-h-screen bg-muted/30">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:py-10">
        <Link
          href={isCustomer ? "/dashboard/messages" : "/host/wiadomosci"}
          className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {isCustomer ? "Moje wiadomości" : "Wiadomości organizatora"}
        </Link>

        <Card className="overflow-hidden">
          <CardHeader className="border-b bg-background">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <MessageCircle className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-lg font-semibold">
                  {isCustomer ? conversation.venue_name : conversation.customer_name}
                </h1>
                <p className="mt-0.5 truncate text-sm text-muted-foreground">
                  {conversation.attraction_title || conversation.organization_name}
                </p>
                {conversation.order_number ? (
                  <Badge variant="outline" className="mt-2">
                    <Ticket className="mr-1.5 h-3.5 w-3.5" />
                    Rezerwacja #{conversation.order_number}
                  </Badge>
                ) : null}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ChatThread
              conversationId={conversation.id}
              currentUserId={user.id}
              initialMessages={(messages ?? []) as MarketplaceChatMessage[]}
            />
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
