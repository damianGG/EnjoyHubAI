"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { UserAvatar } from "@/components/user-avatar"
import { AuthSheet } from "@/components/auth-sheet"
import { SearchDialog } from "@/components/search-dialog"
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Home, LogIn, UserPlus, Menu } from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import type { User } from "@supabase/supabase-js"

export function TopNav({ searchDialogOpen, onSearchDialogChange }: { searchDialogOpen?: boolean, onSearchDialogChange?: (open: boolean) => void }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [authSheetOpen, setAuthSheetOpen] = useState(false)
  const [authMode, setAuthMode] = useState<"login" | "signup">("login")

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

  return (
    <>
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Logo - Icon only on mobile, full on desktop */}
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-primary-foreground font-bold">E</span>
              </div>
              <span className="text-xl font-bold hidden md:inline">EnjoyHub</span>
            </Link>

            {/* Search Dialog - Centered */}
            <div className="flex-1 flex justify-center">
              <SearchDialog open={searchDialogOpen} onOpenChange={onSearchDialogChange} />
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-4">
              {loading ? (
                <div className="h-10 w-32 bg-muted rounded animate-pulse" />
              ) : user ? (
                <>
                  <Link href="/host">
                    <Button variant="ghost" size="sm">
                      <Home className="mr-2 h-4 w-4" />
                      Zostań gospodarzem
                    </Button>
                  </Link>
                  <UserAvatar user={user} />
                </>
              ) : (
                <>
                  <Link href="/host">
                    <Button variant="ghost" size="sm">
                      <Home className="mr-2 h-4 w-4" />
                      Zostań gospodarzem
                    </Button>
                  </Link>
                  <Button variant="ghost" size="sm" onClick={openLoginSheet}>
                    <LogIn className="mr-2 h-4 w-4" />
                    Zaloguj się
                  </Button>
                  <Button variant="default" size="sm" onClick={openSignupSheet}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Zarejestruj się
                  </Button>
                </>
              )}
            </div>

            {/* Mobile Navigation */}
            <div className="md:hidden">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm" aria-label="Open navigation menu">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right">
                  <SheetHeader>
                    <SheetTitle>Menu</SheetTitle>
                  </SheetHeader>
                  <div className="flex flex-col space-y-4 mt-6">
                    {loading ? (
                      <div className="h-10 w-full bg-muted rounded animate-pulse" />
                    ) : user ? (
                      <>
                        <UserAvatar user={user} />
                        <Link href="/host" className="w-full">
                          <Button variant="ghost" size="lg" className="w-full justify-start">
                            <Home className="mr-2 h-4 w-4" />
                            Zostań gospodarzem
                          </Button>
                        </Link>
                      </>
                    ) : (
                      <>
                        <Link href="/host" className="w-full">
                          <Button variant="ghost" size="lg" className="w-full justify-start">
                            <Home className="mr-2 h-4 w-4" />
                            Zostań gospodarzem
                          </Button>
                        </Link>
                        <Button 
                          variant="ghost" 
                          size="lg" 
                          className="w-full justify-start" 
                          onClick={openLoginSheet}
                        >
                          <LogIn className="mr-2 h-4 w-4" />
                          Zaloguj się
                        </Button>
                        <Button 
                          variant="default" 
                          size="lg" 
                          className="w-full justify-start" 
                          onClick={openSignupSheet}
                        >
                          <UserPlus className="mr-2 h-4 w-4" />
                          Zarejestruj się
                        </Button>
                      </>
                    )}
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </div>

      <AuthSheet
        open={authSheetOpen}
        onOpenChange={setAuthSheetOpen}
        mode={authMode}
        onModeChange={setAuthMode}
      />
    </>
  )
}
