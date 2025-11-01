"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Search, Users } from "lucide-react"
import Link from "next/link"
import { CategoryBar } from "@/components/category-bar"
import { FeaturedProperties } from "@/components/featured-properties"
import { UserAvatar } from "@/components/user-avatar"
import { InteractiveMap } from "@/components/interactive-map"
import { AuthSheet } from "@/components/auth-sheet"
import { createClient } from "@/lib/supabase/client"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"

export default function Home() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [selectedProperty, setSelectedProperty] = useState<any>(null)
  const [authSheetOpen, setAuthSheetOpen] = useState(false)
  const [authMode, setAuthMode] = useState<"login" | "signup">("login")

  useEffect(() => {
    const supabase = createClient()

    // Get initial user
    const getUser = async () => {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser()

        if (error) {
          setUser(null)
        } else {
          setUser(user)
        }
      } catch (error) {
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    getUser()

    // Listen for auth changes
    try {
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, session) => {
        setUser(session?.user ?? null)
        setLoading(false)
      })

      return () => subscription.unsubscribe()
    } catch (error) {
      setLoading(false)
    }
  }, [])

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold">E</span>
            </div>
            <span className="text-xl font-bold">EnjoyHub</span>
          </div>

          <nav className="hidden md:flex items-center space-x-6">
            <Link href="/host" className="text-muted-foreground hover:text-foreground">
              Zostań gospodarzem
            </Link>
            {user && (
              <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">
                Dashboard
              </Link>
            )}

            {!loading &&
              (user ? (
                <UserAvatar user={user} />
              ) : (
                <>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setAuthMode("login")
                      setAuthSheetOpen(true)
                    }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Zaloguj się
                  </Button>
                  <Button
                    onClick={() => {
                      setAuthMode("signup")
                      setAuthSheetOpen(true)
                    }}
                  >
                    Zarejestruj się
                  </Button>
                </>
              ))}
          </nav>

          <div className="md:hidden">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] sm:w-[400px]">
                <SheetHeader>
                  <SheetTitle>Menu</SheetTitle>
                </SheetHeader>
                <div className="flex flex-col space-y-4 mt-6">
                  <Link
                    href="/host"
                    className="text-lg font-medium hover:text-primary transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Zostań gospodarzem
                  </Link>

                  {user && (
                    <Link
                      href="/dashboard"
                      className="text-lg font-medium hover:text-primary transition-colors"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Dashboard
                    </Link>
                  )}

                  {!loading && (
                    <>
                      {user ? (
                        <div className="pt-4 border-t">
                          <UserAvatar user={user} />
                        </div>
                      ) : (
                        <div className="flex flex-col space-y-3 pt-4 border-t">
                          <Button
                            variant="outline"
                            className="w-full bg-transparent"
                            onClick={() => {
                              setMobileMenuOpen(false)
                              setAuthMode("login")
                              setAuthSheetOpen(true)
                            }}
                          >
                            Zaloguj się
                          </Button>
                          <Button
                            className="w-full"
                            onClick={() => {
                              setMobileMenuOpen(false)
                              setAuthMode("signup")
                              setAuthSheetOpen(true)
                            }}
                          >
                            Zarejestruj się
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* Search Bar */}
      <section className="py-6 px-4 border-b">
        <div className="container mx-auto">
          <div className="bg-card border rounded-2xl md:rounded-full p-2 max-w-4xl mx-auto shadow-lg">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div className="flex items-center space-x-3 px-4 py-3">
                <Users className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <div className="text-left flex-1">
                  <div className="text-sm font-medium">Ile osób</div>
                  <input
                    type="text"
                    placeholder="Dodaj liczbę osób"
                    className="text-sm text-muted-foreground bg-transparent border-none outline-none w-full"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-3 px-4 py-3 md:border-l">
                <div className="text-left flex-1">
                  <div className="text-sm font-medium">Budżet</div>
                  <div className="text-sm text-muted-foreground">Wybierz zakres</div>
                </div>
              </div>

              <div className="flex items-center justify-between px-4 py-3 md:border-l">
                <div className="flex items-center space-x-3 flex-1">
                  <div className="text-left">
                    <div className="text-sm font-medium">Wiek</div>
                    <div className="text-sm text-muted-foreground">Dla kogo</div>
                  </div>
                </div>
                <Link href="/properties">
                  <Button size="sm" className="rounded-full ml-2">
                    <Search className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Category Bar Section */}
      <section className="border-b bg-background">
        <div className="container mx-auto">
          <CategoryBar selectedCategory={selectedCategory} onCategorySelect={setSelectedCategory} />
        </div>
      </section>

      <section className="flex-1">
        <div className="flex h-[calc(100vh-200px)]">
          {/* Properties List - Left Half */}
          <div className="w-1/2 overflow-y-auto p-6">
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-2">
                {selectedCategory ? "Obiekty w wybranej kategorii" : "Polecane miejsca"}
              </h2>
              <p className="text-muted-foreground">Odkryj najlepsze miejsca rozrywki</p>
            </div>

            <FeaturedProperties selectedCategory={selectedCategory} />

            <div className="mt-6">
              <Link href="/properties">
                <Button variant="outline" size="lg" className="w-full bg-transparent">
                  Zobacz wszystkie obiekty
                </Button>
              </Link>
            </div>
          </div>

          {/* Map - Right Half */}
          <div className="w-1/2 border-l">
            <InteractiveMap selectedCategory={selectedCategory} onPropertySelect={setSelectedProperty} />
          </div>
        </div>
      </section>

      {/* Auth Sheet */}
      <AuthSheet open={authSheetOpen} onOpenChange={setAuthSheetOpen} mode={authMode} onModeChange={setAuthMode} />
    </div>
  )
}
