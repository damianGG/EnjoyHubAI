import { isSupabaseConfigured } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default async function PhoneLoginPage() {
  // If Supabase is not configured, show setup message directly
  if (!isSupabaseConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Konfiguracja wymagana</CardTitle>
            <CardDescription>Połącz Supabase, aby rozpocząć korzystanie z uwierzytelniania</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Skonfiguruj zmienne środowiskowe Supabase w pliku .env.local
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  redirect("/auth/login")
}
