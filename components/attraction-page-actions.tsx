"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { Heart, Share2 } from "lucide-react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

type AttractionActionsContextValue = {
  favorite: boolean
  favoritePending: boolean
  feedback: string
  toggleFavorite: () => Promise<void>
  shareAttraction: () => Promise<void>
}

const AttractionActionsContext = createContext<AttractionActionsContextValue | null>(null)

export function AttractionPageActionsProvider({
  attractionId,
  attractionTitle,
  returnToPath,
  children,
}: {
  attractionId: string
  attractionTitle: string
  returnToPath: string
  children: ReactNode
}) {
  const router = useRouter()
  const [favorite, setFavorite] = useState(false)
  const [favoritePending, setFavoritePending] = useState(false)
  const [feedback, setFeedback] = useState("")

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user || cancelled) return

        const { data, error } = await supabase
          .from("favorites")
          .select("id")
          .eq("user_id", user.id)
          .eq("property_id", attractionId)
          .maybeSingle()

        if (error) throw error
        if (!cancelled) setFavorite(Boolean(data))
      } catch (error) {
        console.error("[attraction-actions] Failed to load favorite state", error)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [attractionId])

  const toggleFavorite = useCallback(async () => {
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
    } catch (error) {
      console.error("[attraction-actions] Failed to update favorite", error)
      setFeedback("Nie udało się zmienić ulubionych")
    } finally {
      setFavoritePending(false)
    }
  }, [attractionId, favorite, favoritePending, returnToPath, router])

  const shareAttraction = useCallback(async () => {
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
  }, [attractionTitle, returnToPath])

  const value = useMemo<AttractionActionsContextValue>(() => ({
    favorite,
    favoritePending,
    feedback,
    toggleFavorite,
    shareAttraction,
  }), [favorite, favoritePending, feedback, shareAttraction, toggleFavorite])

  return <AttractionActionsContext.Provider value={value}>{children}</AttractionActionsContext.Provider>
}

export function AttractionPageActions({
  compact = false,
  className,
}: {
  compact?: boolean
  className?: string
}) {
  const actions = useContext(AttractionActionsContext)
  if (!actions) throw new Error("AttractionPageActions must be used inside AttractionPageActionsProvider")

  const { favorite, favoritePending, feedback, toggleFavorite, shareAttraction } = actions

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
