import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import ForgotPasswordForm from "@/components/forgot-password-form"
import { getSafeAuthReturnTo } from "@/lib/auth/return-to"

interface ForgotPasswordPageProps {
  searchParams: Promise<{ next?: string }>
}

export default async function ForgotPasswordPage({ searchParams }: ForgotPasswordPageProps) {
  if (!isSupabaseConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <h1 className="mb-4 text-2xl font-bold">Połącz Supabase, aby rozpocząć</h1>
      </div>
    )
  }

  const supabase = createClient()
  const [{ data: { user } }, query] = await Promise.all([
    supabase.auth.getUser(),
    searchParams,
  ])
  const returnTo = getSafeAuthReturnTo(query.next)

  if (user) {
    redirect(returnTo)
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <ForgotPasswordForm returnToPath={returnTo} />
    </div>
  )
}
