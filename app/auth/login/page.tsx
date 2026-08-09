import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import UnifiedAuthForm from "@/components/unified-auth-form"

interface LoginPageProps {
  searchParams: Promise<{ error?: string }>
}

const AUTH_ERRORS: Record<string, string> = {
  oauth: "Nie udało się rozpocząć logowania zewnętrznego. Spróbuj ponownie.",
  callback: "Nie udało się dokończyć logowania. Link mógł wygasnąć — spróbuj ponownie.",
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  // If Supabase is not configured, show setup message directly
  if (!isSupabaseConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <h1 className="text-2xl font-bold mb-4">Połącz Supabase, aby rozpocząć</h1>
      </div>
    )
  }

  // Check if user is already logged in
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // If user is logged in, redirect to home page
  if (user) {
    redirect("/")
  }

  const { error } = await searchParams

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <UnifiedAuthForm mode="login" initialError={error ? AUTH_ERRORS[error] || AUTH_ERRORS.callback : undefined} />
    </div>
  )
}
