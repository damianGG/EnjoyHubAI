import Image from "next/image"
import Link from "next/link"
import { ArrowLeft, Heart, Settings, ShoppingBag, Star, Ticket, User } from "lucide-react"
import { redirect } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { formatMoney, formatSessionDate } from "@/lib/ticketing/format"
import { listCustomerTicketingOrders } from "@/lib/ticketing/queries"

export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  if (!isSupabaseConfigured) {
    return <main className="flex min-h-screen items-center justify-center">Połącz Supabase, aby rozpocząć.</main>
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login?next=/dashboard")

  const [orders, favoritesResult, profileResult] = await Promise.all([
    listCustomerTicketingOrders(user.id),
    supabase
      .from("favorites")
      .select(`
        id,
        properties (id, title, city, country, images, rating)
      `)
      .eq("user_id", user.id),
    supabase.from("users").select("full_name, created_at").eq("id", user.id).single(),
  ])
  const favorites = (favoritesResult.data ?? []).filter((favorite: any) => favorite.properties)
  const profile = profileResult.data

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Strona główna
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
              <User className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="hidden font-medium sm:inline">{profile?.full_name || user.email}</span>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Mój panel</h1>
          <p className="mt-2 text-muted-foreground">Bilety, zamówienia, ulubione atrakcje i ustawienia konta.</p>
        </div>

        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <DashboardLink href="/" title="Atrakcje" description="Znajdź nowy termin" />
          <DashboardLink href="/dashboard/bookings" title="Moje bilety" description={`${orders.length} zamówień`} icon={<Ticket className="h-4 w-4" />} />
          <DashboardLink href="/host" title="Panel sprzedaży" description="Oferty i bilety" icon={<ShoppingBag className="h-4 w-4" />} />
          <DashboardLink href="/dashboard/favorites" title="Ulubione" description={`${favorites.length} zapisanych`} icon={<Heart className="h-4 w-4" />} />
          <DashboardLink href="/dashboard/profile" title="Profil" description="Ustawienia konta" icon={<Settings className="h-4 w-4" />} />
        </div>

        <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Ostatnie zamówienia</CardTitle>
              <CardDescription>Zakupy wykonane w nowym checkoutcie EnjoyHub.</CardDescription>
            </CardHeader>
            <CardContent>
              {orders.length === 0 ? (
                <div className="py-10 text-center">
                  <Ticket className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                  <h2 className="font-semibold">Nie masz jeszcze biletów</h2>
                  <p className="mt-2 text-sm text-muted-foreground">Wybierz atrakcję, termin i kup pierwszy bilet.</p>
                  <Button asChild className="mt-5"><Link href="/">Przeglądaj atrakcje</Link></Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {orders.slice(0, 3).map((order) => {
                    const firstItem = order.items[0]
                    return (
                      <div key={order.id} className="rounded-lg border p-4">
                        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                          <div>
                            <p className="font-semibold">{firstItem?.productName ?? order.venueName}</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {firstItem ? formatSessionDate(firstItem.startsAt, order.venueTimezone) : order.venueName}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={order.paymentStatus === "paid" ? "default" : "secondary"}>
                              {order.paymentStatus === "paid" ? "Opłacone" : "W toku"}
                            </Badge>
                            <span className="font-semibold">{formatMoney(order.totalAmount, order.currency)}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  <Button asChild variant="outline" className="w-full">
                    <Link href="/dashboard/bookings">Zobacz wszystkie bilety i zamówienia</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Ulubione</CardTitle></CardHeader>
              <CardContent>
                {favorites.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Brak zapisanych atrakcji.</p>
                ) : (
                  <div className="space-y-3">
                    {favorites.slice(0, 2).map((favorite: any) => (
                      <Link key={favorite.id} href={`/attractions/${favorite.properties.id}`} className="flex gap-3 rounded-md p-1 hover:bg-muted">
                        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded">
                          <Image
                            src={favorite.properties.images?.[0] || "/placeholder.jpg"}
                            alt={favorite.properties.title}
                            fill
                            sizes="48px"
                            className="object-cover"
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{favorite.properties.title}</p>
                          <p className="text-xs text-muted-foreground">{favorite.properties.city}</p>
                          <p className="mt-1 flex items-center gap-1 text-xs"><Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />{favorite.properties.rating || "Nowość"}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Podsumowanie konta</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <SummaryRow label="Zamówienia biletowe" value={orders.length} />
                <SummaryRow label="Zapisane atrakcje" value={favorites.length} />
                <SummaryRow label="Członek od" value={profile?.created_at ? new Date(profile.created_at).getFullYear() : new Date().getFullYear()} />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  )
}

function DashboardLink({
  href,
  title,
  description,
  icon,
}: {
  href: string
  title: string
  description: string
  icon?: React.ReactNode
}) {
  return (
    <Link href={href}>
      <Card className="h-full transition-colors hover:bg-accent">
        <CardHeader className="p-4">
          <CardTitle className="flex items-center gap-2 text-base">{icon}{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
      </Card>
    </Link>
  )
}

function SummaryRow({ label, value }: { label: string; value: string | number }) {
  return <div className="flex justify-between gap-4"><span className="text-muted-foreground">{label}</span><span className="font-medium">{value}</span></div>
}
