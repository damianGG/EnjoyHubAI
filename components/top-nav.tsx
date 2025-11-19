"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { AuthSheet } from "@/components/auth-sheet"
import { Search, User as UserIcon, Plus, LogOut, Settings, Heart } from "lucide-react"
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
import Image from "next/image"

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
    
    // Get initial session
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => {
      if (subscription && typeof subscription.unsubscribe === 'function') {
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
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            {/* Logo - Left side */}
            <Link href="/" className="flex items-center flex-shrink-0">
              <div className="flex items-center space-x-2">
                <Image 
                  src="/placeholder-logo.svg" 
                  alt="EnjoyHub" 
                  width={40} 
                  height={40}
                  className="h-8 w-8 md:h-10 md:w-10"
                />
                <span className="hidden sm:block text-xl md:text-2xl font-bold text-primary">EnjoyHub</span>
              </div>
            </Link>

            {/* Search Button - Center */}
            <Button
              onClick={onSearchClick}
              variant="outline"
              size="lg"
              className="flex-1 max-w-xl bg-white hover:bg-gray-50 border-2 justify-start text-left font-normal h-12 md:h-14 rounded-full shadow-sm"
            >
              <Search className="h-4 w-4 md:h-5 md:w-5 mr-2 md:mr-3 text-muted-foreground" />
              <span className="text-sm md:text-base text-muted-foreground">Wyszukaj</span>
            </Button>

            {/* Action Buttons - Right side */}
            <div className="hidden md:flex items-center gap-2">
              {/* Add Object Button */}
              <Link href="/host/properties/new">
                <Button variant="ghost" className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  <span>Dodaj obiekt rozrywki</span>
                </Button>
              </Link>

              {/* User Authentication */}
              {loading ? (
                <div className="h-10 w-20 bg-muted rounded-lg animate-pulse" />
              ) : user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.user_metadata?.avatar_url || ""} alt={displayName} />
                        <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <span className="hidden lg:inline">{displayName}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="end" sideOffset={10}>
                    <div className="flex items-center justify-start gap-2 p-2">
                      <div className="flex flex-col space-y-1 leading-none">
                        <p className="font-medium">{displayName}</p>
                        <p className="w-[200px] truncate text-sm text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/dashboard" className="cursor-pointer">
                        <UserIcon className="mr-2 h-4 w-4" />
                        Dashboard
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/dashboard/favorites" className="cursor-pointer">
                        <Heart className="mr-2 h-4 w-4" />
                        Ulubione
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/dashboard/profile" className="cursor-pointer">
                        <Settings className="mr-2 h-4 w-4" />
                        Ustawienia
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="cursor-pointer text-red-600 focus:text-red-600"
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
                  <Button variant="ghost" onClick={openLoginSheet}>
                    Zaloguj
                  </Button>
                  <Button onClick={openSignupSheet}>
                    Zarejestruj
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Auth Sheet */}
      <AuthSheet
        open={authSheetOpen}
        onOpenChange={setAuthSheetOpen}
        mode={authMode}
        onModeChange={setAuthMode}
        returnToPath="/dashboard"
      />

      {/* Logout Confirmation Dialog */}
      <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Potwierdź wylogowanie</AlertDialogTitle>
            <AlertDialogDescription>
              Czy na pewno chcesz się wylogować? Zostaniesz przekierowany do strony głównej.
            </AlertDialogDescription>
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
