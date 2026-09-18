"use client"

import { useState } from "react"
import { Heart, Share2 } from "lucide-react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

interface AttractionPageActionsProps {
  attractionId: string
  attractionTitle: string
  returnToPath: string
  initialFavorite: boolean
  compact?: boolean
  className?: string
}

export function AttractionPageActions({
  attractionId,
  attractionTitle,
  returnToPath,
  initialFavorite,
  compact = false,
  className,
}: AttractionPageActionsProps) {
  const router = useRouter()
  const [favorite, setFavorite] = useState(initialFavorite)
  const [favoritePending, setFavoritePending] = useState(false)
  const [feedback, setFeedback] = useState("")

  async function toggleFavorite() {
    if (favoritePending) return

    setFavoritePending(true)
    setFeedback("")

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push(`/auth/login?next=${encodeURIComponent(returnToPath)}`)
        return
      }

      const query = favorite
        ? supabase.from("favorites").delete().eq("user_id", user.id).eq("property_id", attractionId)
        : supabase.from("favorites").insert({ user_id: user.id, property_id: attractionId })

      const { error } = await query
      if (error) throw error

      const nextFavorite = !favorite
      setFavorite(nextFavorite)
      setFeedback(nextFavorite ? "Dodano do ulubionych" : "Usunięto z ulubionych")
      router.refresh()
    } catch (error) {
      console.error("[attraction-actions] Failed to update favorite", error)
      setFeedback("Nie udało się zmienić ulubionych")
    } finally {
      setFavoritePending(false)
    }
  }

  async function shareAttraction() {
    setFeedback("")
    const url = `${window.location.origin}${returnToPath}`

    try {
      if (navigator.share) {
        await navigator.share({ title: attractionTitle, url })
        setFeedback("Udostępniono")
        return
      }

      await navigator.clipboard.writeText(url)
      setFeedback("Link skopiowany")
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return
      console.error("[attraction-actions] Failed to share attraction", error)
      setFeedback("Nie udało się udostępnić")
    }
  }

  if (compact) {
    return (
      <div className={cn("flex gap-2", className)}>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={shareAttraction}
          className="pointer-events-auto h-11 w-11 rounded-full bg-white/95 text-[#0b1220] shadow-lg backdrop-blur"
          aria-label="Udostępnij atrakcję"
        >
          <Share2 className="h-5 w-5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={toggleFavorite}
          disabled={favoritePending}
          className="pointer-events-auto h-11 w-11 rounded-full bg-white/95 text-[#0b1220] shadow-lg backdrop-blur"
          aria-label={favorite ? "Usuń z ulubionych" : "Dodaj do ulubionych"}
          aria-pressed={favorite}
        >
          <Heart className={cn("h-5 w-5", favorite && "fill-primary text-primary")} />
        </Button>
        <span className="sr-only" aria-live="polite">{feedback}</span>
      </div>
    )
  }

  return (
    <div className={cn("flex shrink-0 gap-2", className)}>
      <Button type="button" variant="outline" size="sm" onClick={toggleFavorite} disabled={favoritePending} aria-pressed={favorite}>
        <Heart className={cn("mr-2 h-4 w-4", favorite && "fill-primary text-primary")} />
        {favorite ? "Zapisano" : "Zapisz"}
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={shareAttraction}>
        <Share2 className="mr-2 h-4 w-4" />
        {feedback === "Link skopiowany" ? "Link skopiowany" : "Udostępnij"}
      </Button>
      <span className="sr-only" aria-live="polite">{feedback}</span>
    </div>
  )
}
