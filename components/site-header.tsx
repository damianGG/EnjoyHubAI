"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import type { User } from "@supabase/supabase-js"
import { Button } from "@/components/ui/button"
import { useT } from "@/components/i18n-provider"

export function SiteHeader() {
  const t = useT()
  const router = useRouter()
  const supabase = createClientComponentClient()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      router.refresh()
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase.auth, router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/")
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center space-x-2">
            <span className="font-bold text-xl">EnjoyHub</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link
              href="/"
              className="text-sm font-medium transition-colors hover:text-primary"
            >
              {t("nav.home")}
            </Link>
            {/* Placeholder for future navigation links */}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          {loading ? (
            <div className="h-9 w-20 animate-pulse bg-muted rounded" />
          ) : user ? (
            <>
              {/* Placeholder for future authenticated user links */}
              <Button
                variant="ghost"
                onClick={handleLogout}
                className="text-sm font-medium"
              >
                {t("nav.logout")}
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" asChild>
                <Link href="/login" className="text-sm font-medium">
                  {t("nav.login")}
                </Link>
              </Button>
              <Button asChild>
                <Link href="/signup" className="text-sm font-medium">
                  {t("nav.signup")}
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
