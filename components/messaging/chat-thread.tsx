"use client"

import { FormEvent, useEffect, useRef, useState } from "react"
import { Send } from "lucide-react"

import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"

export interface MarketplaceChatMessage {
  id: string
  conversation_id: string
  sender_user_id: string
  body: string
  read_at: string | null
  created_at: string
}

interface ChatThreadProps {
  conversationId: string
  currentUserId: string
  initialMessages: MarketplaceChatMessage[]
}

export function ChatThread({
  conversationId,
  currentUserId,
  initialMessages,
}: ChatThreadProps) {
  const [messages, setMessages] = useState(initialMessages)
  const [body, setBody] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const supabase = createClient()

    const markRead = async () => {
      await supabase.rpc("marketplace_mark_conversation_read", {
        p_conversation_id: conversationId,
      })
    }

    void markRead()

    const channel = supabase
      .channel(`marketplace-conversation-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "marketplace_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const incoming = payload.new as MarketplaceChatMessage
          setMessages((current) =>
            current.some((message) => message.id === incoming.id)
              ? current
              : [...current, incoming],
          )

          if (incoming.sender_user_id !== currentUserId) {
            void markRead()
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "marketplace_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const updated = payload.new as MarketplaceChatMessage
          setMessages((current) =>
            current.map((message) => message.id === updated.id ? updated : message),
          )
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [conversationId, currentUserId])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages.length])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = body.trim()
    if (!trimmed || sending) return

    setSending(true)
    setError(null)

    const supabase = createClient()
    const { data, error: insertError } = await supabase
      .from("marketplace_messages")
      .insert({
        conversation_id: conversationId,
        sender_user_id: currentUserId,
        body: trimmed,
      })
      .select("id, conversation_id, sender_user_id, body, read_at, created_at")
      .single()

    if (insertError || !data) {
      setError("Nie udało się wysłać wiadomości. Spróbuj ponownie.")
      setSending(false)
      return
    }

    setMessages((current) =>
      current.some((message) => message.id === data.id)
        ? current
        : [...current, data as MarketplaceChatMessage],
    )
    setBody("")
    setSending(false)
  }

  return (
    <div className="flex min-h-[520px] flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-5 sm:px-6">
        {messages.length === 0 ? (
          <div className="mx-auto max-w-sm py-16 text-center">
            <p className="font-medium">Napisz pierwszą wiadomość</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Rozmowa służy do krótkich ustaleń dotyczących atrakcji lub rezerwacji.
            </p>
          </div>
        ) : (
          messages.map((message) => {
            const own = message.sender_user_id === currentUserId
            return (
              <div key={message.id} className={`flex ${own ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-sm leading-6 sm:max-w-[70%] ${
                    own
                      ? "rounded-br-md bg-primary text-primary-foreground"
                      : "rounded-bl-md bg-muted text-foreground"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{message.body}</p>
                  <p
                    className={`mt-1 text-[10px] ${
                      own ? "text-primary-foreground/70" : "text-muted-foreground"
                    }`}
                  >
                    {formatMessageTime(message.created_at)}
                    {own && message.read_at ? " · Przeczytano" : ""}
                  </p>
                </div>
              </div>
            )
          })
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={handleSubmit} className="border-t bg-background p-3 sm:p-4">
        <div className="flex items-end gap-2">
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            maxLength={2000}
            rows={2}
            placeholder="Napisz wiadomość…"
            className="min-h-[46px] flex-1 resize-none rounded-xl border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
            aria-label="Treść wiadomości"
          />
          <Button
            type="submit"
            size="icon"
            className="h-11 w-11 shrink-0 rounded-xl"
            disabled={sending || body.trim().length === 0}
            aria-label="Wyślij wiadomość"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <div className="mt-1 flex items-center justify-between gap-3 px-1">
          <p className="text-xs text-muted-foreground">
            Wiadomości tekstowe · bez załączników
          </p>
          <p className="text-xs text-muted-foreground">{body.length}/2000</p>
        </div>
        {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
      </form>
    </div>
  )
}

function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat("pl-PL", {
    timeZone: "Europe/Warsaw",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}
