import Link from "next/link"
import { ArrowLeft, User } from "lucide-react"
import { redirect } from "next/navigation"

import { updateProfileAction } from "@/app/dashboard/profile/actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>
}) {
  if (!isSupabaseConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-center">
        <h1 className="text-2xl font-bold">Profil jest chwilowo niedostępny</h1>
      </div>
    )
  }

  const query = await searchParams
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login?next=/dashboard/profile")
  }

  const { data: userProfile } = await supabase
    .from("users")
    .select("full_name, phone, bio")
    .eq("id", user.id)
    .single()

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <Link href="/dashboard" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Powrót do panelu
          </Link>
        </div>
      </header>

      <div className="container mx-auto max-w-2xl px-4 py-8">
        <div className="mb-8">
          <h1 className="mb-2 flex items-center gap-2 text-3xl font-bold">
            <User className="h-8 w-8" />
            <span>Mój profil</span>
          </h1>
          <p className="text-muted-foreground">Zmień dane używane na Twoim koncie EnjoyHub.</p>
        </div>

        {query.saved === "1" ? (
          <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-950" role="status">
            Zmiany zostały zapisane.
          </div>
        ) : null}

        {query.error ? (
          <div className="mb-5 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive" role="alert">
            {query.error === "validation"
              ? "Sprawdź imię i nazwisko i spróbuj ponownie."
              : "Nie udało się zapisać zmian. Spróbuj ponownie."}
          </div>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Dane profilu</CardTitle>
            <CardDescription>Po zapisaniu od razu zaktualizujemy dane Twojego konta.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateProfileAction} className="space-y-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Imię i nazwisko</Label>
                  <Input
                    id="full_name"
                    name="full_name"
                    defaultValue={userProfile?.full_name || ""}
                    placeholder="Wpisz imię i nazwisko"
                    maxLength={120}
                    autoComplete="name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input id="email" type="email" defaultValue={user.email || ""} disabled className="bg-muted" />
                  <p className="text-xs text-muted-foreground">Adres e-mail służy do logowania i potwierdzeń.</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Numer telefonu</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  defaultValue={userProfile?.phone || ""}
                  placeholder="Np. 500 600 700"
                  maxLength={30}
                  autoComplete="tel"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">O mnie</Label>
                <Textarea
                  id="bio"
                  name="bio"
                  defaultValue={userProfile?.bio || ""}
                  placeholder="Opcjonalnie napisz kilka słów o sobie."
                  rows={4}
                  maxLength={500}
                />
                <p className="text-xs text-muted-foreground">To pole jest opcjonalne.</p>
              </div>

              <Button type="submit">Zapisz zmiany</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
