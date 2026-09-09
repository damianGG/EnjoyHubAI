"use client"

import { useState, useEffect } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { AuthSheet } from "@/components/auth-sheet"
import { Compass, Heart, Plus, User as UserIcon } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
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
import { LogOut, Settings } from "lucide-react"

interface BottomNavProps {
  onSearchClick?: () => void
}

export function BottomNav({ onSearchClick }: BottomNavProps) {
  const pathname = usePathname()
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription?.unsubscribe?.()
  }, [])

  const openLoginSheet = () => {
    setAuthMode("login")
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
  const initials = displayName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
  const isActive = (path: string) => pathname === path

  const itemClass = (active: boolean) =>
    `flex min-w-[58px] flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[10px] font-semibold transition-all ${
      active ? "text-primary" : "text-muted-foreground"
    }`

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(8px,env(safe-area-inset-bottom))] md:hidden">
        <div className="pointer-events-auto mx-auto max-w-md rounded-[26px] border border-[#0b1220]/[0.07] bg-white/95 px-2 py-1.5 shadow-[0_16px_42px_rgba(11,18,32,0.18)] backdrop-blur-xl">
          <div className="grid grid-cols-4 items-center gap-1">
            <button onClick={onSearchClick} className={itemClass(isActive('/'))}>
              <span className={`grid h-8 w-8 place-items-center rounded-xl ${isActive('/') ? 'bg-primary text-white shadow-[0_6px_14px_rgba(255,90,31,0.25)]' : 'bg-secondary'}`}>
                <Compass className="h-4 w-4" />
              </span>
              Odkrywaj
            </button>

            <Link href="/dashboard/favorites" className={itemClass(isActive('/dashboard/favorites'))}>
              <span className={`grid h-8 w-8 place-items-center rounded-xl ${isActive('/dashboard/favorites') ? 'bg-primary text-white' : 'bg-secondary'}`}>
                <Heart className="h-4 w-4" />
              </span>
              Ulubione
            </Link>

            <Link href="/dla-organizatorow" className={itemClass(isActive('/dla-organizatorow'))}>
              <span className={`grid h-8 w-8 place-items-center rounded-xl ${isActive('/dla-organizatorow') ? 'bg-primary text-white' : 'bg-secondary'}`}>
                <Plus className="h-4 w-4" />
              </span>
              Dodaj miejsce
            </Link>

            {loading ? (
              <div className="mx-auto h-12 w-14 animate-pulse rounded-xl bg-muted" />
            ) : user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className={itemClass(pathname.startsWith('/dashboard'))}>
                    <Avatar className="h-8 w-8 ring-2 ring-white shadow-sm">
                      <AvatarImage src={user.user_metadata?.avatar_url || ""} alt={displayName} />
                      <AvatarFallback className="bg-primary text-[9px] text-white">{initials}</AvatarFallback>
                    </Avatar>
                    Profil
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="mb-3 w-60 rounded-2xl p-2" align="end">
                  <div className="p-2">
                    <p className="font-semibold">{displayName}</p>
                    <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild className="rounded-xl"><Link href="/dashboard"><UserIcon className="mr-2 h-4 w-4" />Dashboard</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild className="rounded-xl"><Link href="/dashboard/favorites"><Heart className="mr-2 h-4 w-4" />Ulubione</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild className="rounded-xl"><Link href="/dashboard/profile"><Settings className="mr-2 h-4 w-4" />Ustawienia</Link></DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="rounded-xl text-red-600 focus:text-red-600" onClick={() => setShowLogoutDialog(true)} disabled={isLoading}>
                    <LogOut className="mr-2 h-4 w-4" />{isLoading ? "Wylogowywanie..." : "Wyloguj się"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <button onClick={openLoginSheet} className={itemClass(authSheetOpen)}>
                <span className={`grid h-8 w-8 place-items-center rounded-xl ${authSheetOpen ? 'bg-primary text-white' : 'bg-secondary'}`}>
                  <UserIcon className="h-4 w-4" />
                </span>
                Profil
              </button>
            )}
          </div>
        </div>
      </div>

      <AuthSheet open={authSheetOpen} onOpenChange={setAuthSheetOpen} mode={authMode} onModeChange={setAuthMode} returnToPath="/host" />

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