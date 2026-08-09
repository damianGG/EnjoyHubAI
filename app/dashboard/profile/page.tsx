import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, User } from "lucide-react"
import Link from "next/link"

export default async function ProfilePage() {
  if (!isSupabaseConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <h1 className="text-2xl font-bold mb-4">Połącz Supabase, aby rozpocząć</h1>
      </div>
    )
  }

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: userProfile } = await supabase.from("users").select("*").eq("id", user.id).single()

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center space-x-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Powrót do panelu
          </Link>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center space-x-2">
            <User className="h-8 w-8" />
            <span>Mój profil</span>
          </h1>
          <p className="text-muted-foreground">Zarządzaj danymi konta i preferencjami</p>
        </div>

        <div className="space-y-6">
          {/* Profile Information */}
          <Card>
            <CardHeader>
              <CardTitle>Dane profilu</CardTitle>
              <CardDescription>Zaktualizuj swoje dane osobowe</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Imię i nazwisko</Label>
                  <Input
                    id="full_name"
                    defaultValue={userProfile?.full_name || ""}
                    placeholder="Wpisz imię i nazwisko"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input id="email" type="email" defaultValue={user.email || ""} disabled className="bg-muted" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Numer telefonu</Label>
                  <Input id="phone" defaultValue={userProfile?.phone || ""} placeholder="Wpisz numer telefonu" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Lokalizacja</Label>
                  <Input id="location" defaultValue={userProfile?.location || ""} placeholder="Miasto, kraj" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bio">O mnie</Label>
                <Textarea
                  id="bio"
                  defaultValue={userProfile?.bio || ""}
                  placeholder="Napisz coś o sobie..."
                  rows={3}
                />
              </div>
              <Button>Zapisz zmiany</Button>
            </CardContent>
          </Card>

          {/* Account Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Ustawienia konta</CardTitle>
              <CardDescription>Zarządzaj preferencjami konta</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Powiadomienia e-mail</h4>
                  <p className="text-sm text-muted-foreground">Otrzymuj potwierdzenia rezerwacji i aktualizacje</p>
                </div>
                <Button variant="outline" size="sm">
                  Konfiguruj
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Ustawienia prywatności</h4>
                  <p className="text-sm text-muted-foreground">Decyduj, kto może zobaczyć Twój profil</p>
                </div>
                <Button variant="outline" size="sm">
                  Zarządzaj
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Weryfikacja konta</h4>
                  <p className="text-sm text-muted-foreground">Zweryfikuj tożsamość, aby zwiększyć zaufanie</p>
                </div>
                <Button variant="outline" size="sm">
                  Zweryfikuj
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Account Statistics */}
          <Card>
            <CardHeader>
              <CardTitle>Statystyki konta</CardTitle>
              <CardDescription>Podsumowanie Twojej aktywności</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold">0</div>
                  <div className="text-sm text-muted-foreground">Wszystkie rezerwacje</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">0</div>
                  <div className="text-sm text-muted-foreground">Wystawione opinie</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">0</div>
                  <div className="text-sm text-muted-foreground">Ulubione</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {userProfile?.created_at
                      ? new Date().getFullYear() - new Date(userProfile.created_at).getFullYear()
                      : 0}
                  </div>
                  <div className="text-sm text-muted-foreground">Lat z nami</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
