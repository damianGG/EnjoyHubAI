"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { User } from "@supabase/supabase-js"
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

import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { AuthSheet } from "@/components/auth-sheet"
import { BrandLogo } from "@/components/brand-logo"
import { createClient } from "@/lib/supabase/client"
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

    supabase.auth.getUser().then(({ data: { user: currentUser } }) => {
      setUser(currentUser)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription?.unsubscribe?.()
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
    .map((name: string) => name[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  return (
    <>
      <header className="border-b border-black/[0.06] bg-white/95 backdrop-blur-xl">
        {/* Mobile: compact brand + search. The map is deliberately not the visual priority here. */}
        <div className="px-3 pb-2.5 pt-[max(8px,env(safe-area-inset-top))] md:hidden">
          <div className="mb-2.5 flex h-9 items-center justify-between">
            <BrandLogo mobile />
            <div className="flex items-center gap-1.5">
              <Link
                href="/dashboard/favorites"
                className="grid h-9 w-9 place-items-center rounded-full border border-black/[0.06] bg-white"
                aria-label="Ulubione"
              >
                <Heart className="h-[17px] w-[17px]" />
              </Link>

              {loading ? (
                <div className="h-9 w-9 animate-pulse rounded-full bg-muted" />
              ) : user ? (
                <Link
                  href="/dashboard"
                  className="grid h-9 w-9 place-items-center rounded-full border border-black/[0.06] bg-white"
                  aria-label="Konto"
                >
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={user.user_metadata?.avatar_url || ""} alt={displayName} />
                    <AvatarFallback className="bg-primary text-[10px] font-bold text-white">{initials}</AvatarFallback>
                  </Avatar>
                </Link>
              ) : (
                <button
                  onClick={openLoginSheet}
                  className="grid h-9 w-9 place-items-center rounded-full border border-black/[0.06] bg-white"
                  aria-label="Zaloguj się"
                >
                  <UserIcon className="h-[18px] w-[18px]" />
                </button>
              )}
            </div>
          </div>

          <button
            onClick={onSearchClick}
            className="flex h-[50px] w-full items-center rounded-full border border-black/[0.08] bg-white px-2 text-left shadow-[0_5px_18px_rgba(53,37,20,0.09)]"
            aria-label="Otwórz wyszukiwarkę atrakcji"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-primary">
              <Search className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1 px-2.5">
              <span className="block truncate text-[12.5px] font-bold leading-tight text-foreground">Czego szukasz?</span>
              <span className="mt-0.5 block truncate text-[10.5px] font-medium text-muted-foreground">W pobliżu · Kiedy? · Liczba osób</span>
            </span>
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-white shadow-[0_6px_14px_rgba(244,117,33,0.24)]">
              <Search className="h-3.5 w-3.5" />
            </span>
          </button>
        </div>

        {/* Desktop */}
        <div className="mx-auto hidden max-w-[1600px] px-6 py-4 md:block">
          <div className="flex items-center gap-5">
            <div className="shrink-0"><BrandLogo /></div>

            <nav className="hidden items-center gap-1 text-sm font-medium text-muted-foreground xl:flex">
              <Link href="/attractions" className="rounded-full px-3 py-2 transition-colors hover:bg-secondary hover:text-foreground">Odkrywaj</Link>
              <Link href="/attractions?sort=rating" className="rounded-full px-3 py-2 transition-colors hover:bg-secondary hover:text-foreground">Popularne</Link>
              <Link href="/dla-organizatorow" className="rounded-full px-3 py-2 transition-colors hover:bg-secondary hover:text-foreground">Dla firm</Link>
            </nav>

            <button
              onClick={onSearchClick}
              className="brand-surface group mx-auto flex h-[58px] min-w-0 flex-1 items-center rounded-full px-2 text-left transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(56,38,20,0.10)] md:max-w-[680px]"
              aria-label="Otwórz wyszukiwarkę atrakcji"
            >
              <span className="flex min-w-0 flex-1 items-center gap-3 px-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-secondary text-primary"><Search className="h-5 w-5" /></span>
                <span className="min-w-0"><span className="block truncate text-[15px] font-semibold text-foreground">Znajdź atrakcję</span></span>
              </span>
              <span className="flex min-w-[145px] items-center gap-2 border-l px-4">
                <MapPin className="h-4 w-4 shrink-0 text-primary" />
                <span><span className="block text-[11px] font-medium text-muted-foreground">Lokalizacja</span><span className="block text-sm font-semibold text-foreground">W pobliżu</span></span>
              </span>
              <span className="hidden min-w-[125px] items-center gap-2 border-l px-4 lg:flex">
                <CalendarDays className="h-4 w-4 shrink-0 text-primary" />
                <span><span className="block text-[11px] font-medium text-muted-foreground">Kiedy</span><span className="block text-sm font-semibold text-foreground">Dowolnie</span></span>
              </span>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_8px_20px_rgba(244,117,33,0.28)] transition-transform group-hover:scale-105"><Search className="h-4 w-4" /></span>
            </button>

            <div className="flex shrink-0 items-center gap-2">
              <Button asChild variant="ghost" className="hidden rounded-full px-4 font-semibold lg:inline-flex">
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
                    <div className="p-2"><p className="font-semibold">{displayName}</p><p className="truncate text-xs text-muted-foreground">{user.email}</p></div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild className="rounded-xl"><Link href="/dashboard"><UserIcon className="mr-2 h-4 w-4" />Dashboard</Link></DropdownMenuItem>
                    <DropdownMenuItem asChild className="rounded-xl"><Link href="/dashboard/favorites"><Heart className="mr-2 h-4 w-4" />Ulubione</Link></DropdownMenuItem>
                    <DropdownMenuItem asChild className="rounded-xl"><Link href="/dashboard/profile"><Settings className="mr-2 h-4 w-4" />Ustawienia</Link></DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="cursor-pointer rounded-xl text-red-600 focus:text-red-600" onClick={() => setShowLogoutDialog(true)} disabled={isLoading}>
                      <LogOut className="mr-2 h-4 w-4" />{isLoading ? "Wylogowywanie..." : "Wyloguj się"}
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
        returnToPath="/"
      />

      <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Potwierdź wylogowanie</AlertDialogTitle>
            <AlertDialogDescription>Czy na pewno chcesz się wylogować?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={handleSignOut} disabled={isLoading}>{isLoading ? "Wylogowywanie..." : "Wyloguj się"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
