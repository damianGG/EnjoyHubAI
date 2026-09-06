"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { AuthSheet } from "@/components/auth-sheet"
import {
  CalendarDays,
  Heart,
  LogOut,
  MapPin,
  Menu,
  Search,
  Settings,
  User as UserIcon,
} from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import type { User } from "@supabase/supabase-js"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useRouter } from "next/navigation"
import { BrandLogo } from "@/components/brand-logo"

export function TopNav({ onSearchClick }: { onSearchClick?: () => void }) {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [authSheetOpen, setAuthSheetOpen] = useState(false)
  const [authMode, setAuthMode] = useState<"login" | "signup">("login")
  const [showLogoutDialog, setShowLogoutDialog] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => {
      if (subscription && typeof subscription.unsubscribe === "function") {
        subscription.unsubscribe()
      }
    }
  }, [])

  const openLoginSheet = () => {
    setAuthMode("login")
    setAuthSheetOpen(true)
  }

  const openSignupSheet = () => {
    setAuthMode("signup")
    setAuthSheetOpen(true)
  }

  const handleSignOut = async () => {
    setIsLoading(true)
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      setShowLogoutDialog(false)
      router.refresh()
    } catch (error) {
      console.error("Error signing out:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User"
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  return (
    <>
      <header className="border-b border-black/[0.06] bg-white/90 backdrop-blur-xl">
        <div className="mx-auto max-w-[1600px] px-3 py-3 md:px-6 md:py-4">
          <div className="flex items-center gap-3 md:gap-5">
            <div className="shrink-0">
              <BrandLogo compact={false} />
            </div>

            <nav className="hidden xl:flex items-center gap-1 text-sm font-medium text-muted-foreground">
              <Link href="/attractions" className="rounded-full px-3 py-2 transition-colors hover:bg-secondary hover:text-foreground">
                Odkrywaj
              </Link>
              <Link href="/attractions?sort=rating" className="rounded-full px-3 py-2 transition-colors hover:bg-secondary hover:text-foreground">
                Popularne
              </Link>
              <Link href="/dla-organizatorow" className="rounded-full px-3 py-2 transition-colors hover:bg-secondary hover:text-foreground">
                Dla firm
              </Link>
            </nav>

            <button
              onClick={onSearchClick}
              className="brand-surface group mx-auto flex h-[52px] min-w-0 flex-1 items-center rounded-full px-2 text-left transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(56,38,20,0.10)] md:max-w-[680px] md:h-[58px]"
              aria-label="Otwórz wyszukiwarkę atrakcji"
            >
              <span className="flex min-w-0 flex-1 items-center gap-3 px-3 md:px-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-primary md:h-10 md:w-10">
                  <Search className="h-4 w-4 md:h-5 md:w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-foreground md:text-[15px]">Znajdź atrakcję</span>
                  <span className="block truncate text-xs text-muted-foreground md:hidden">Gdzie i kiedy?</span>
                </span>
              </span>

              <span className="hidden min-w-[145px] items-center gap-2 border-l px-4 md:flex">
                <MapPin className="h-4 w-4 shrink-0 text-primary" />
                <span>
                  <span className="block text-[11px] font-medium text-muted-foreground">Lokalizacja</span>
                  <span className="block text-sm font-semibold text-foreground">W pobliżu</span>
                </span>
              </span>

              <span className="hidden min-w-[125px] items-center gap-2 border-l px-4 lg:flex">
                <CalendarDays className="h-4 w-4 shrink-0 text-primary" />
                <span>
                  <span className="block text-[11px] font-medium text-muted-foreground">Kiedy</span>
                  <span className="block text-sm font-semibold text-foreground">Dowolnie</span>
                </span>
              </span>

              <span className="hidden h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_8px_20px_rgba(244,117,33,0.28)] transition-transform group-hover:scale-105 md:grid">
                <Search className="h-4 w-4" />
              </span>
            </button>

            <div className="hidden md:flex shrink-0 items-center gap-2">
              <Button asChild variant="ghost" className="hidden lg:inline-flex rounded-full px-4 font-semibold">
                <Link href="/dla-organizatorow">Zostań gospodarzem</Link>
              </Button>

              {loading ? (
                <div className="h-10 w-20 animate-pulse rounded-full bg-muted" />
              ) : user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="h-11 rounded-full border-black/10 bg-white px-2.5 shadow-sm">
                      <Menu className="h-4 w-4" />
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={user.user_metadata?.avatar_url || ""} alt={displayName} />
                        <AvatarFallback className="bg-primary text-xs text-primary-foreground">{initials}</AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-60 rounded-2xl p-2" align="end" sideOffset={10}>
                    <div className="p-2">
                      <p className="font-semibold">{displayName}</p>
                      <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild className="rounded-xl">
                      <Link href="/dashboard" className="cursor-pointer"><UserIcon className="mr-2 h-4 w-4" />Dashboard</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="rounded-xl">
                      <Link href="/dashboard/favorites" className="cursor-pointer"><Heart className="mr-2 h-4 w-4" />Ulubione</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="rounded-xl">
                      <Link href="/dashboard/profile" className="cursor-pointer"><Settings className="mr-2 h-4 w-4" />Ustawienia</Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="cursor-pointer rounded-xl text-red-600 focus:text-red-600"
                      onClick={() => setShowLogoutDialog(true)}
                      disabled={isLoading}
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      {isLoading ? "Wylogowywanie..." : "Wyloguj się"}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <>
                  <Button variant="ghost" className="rounded-full" onClick={openLoginSheet}>Zaloguj</Button>
                  <Button className="rounded-full px-5 orange-glow" onClick={openSignupSheet}>Dołącz</Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <AuthSheet
        open={authSheetOpen}
        onOpenChange={setAuthSheetOpen}
        mode={authMode}
        onModeChange={setAuthMode}
        returnToPath="/host"
      />

      <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Potwierdź wylogowanie</AlertDialogTitle>
            <AlertDialogDescription>Czy na pewno chcesz się wylogować?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={handleSignOut} disabled={isLoading}>
              {isLoading ? "Wylogowywanie..." : "Wyloguj się"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
