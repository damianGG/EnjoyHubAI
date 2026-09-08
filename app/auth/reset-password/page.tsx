import { isSupabaseConfigured } from "@/lib/supabase/server"
import ResetPasswordForm from "@/components/reset-password-form"
import { getSafeAuthReturnTo } from "@/lib/auth/return-to"

interface ResetPasswordPageProps {
  searchParams: Promise<{ next?: string }>
}

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  if (!isSupabaseConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <h1 className="mb-4 text-2xl font-bold">Połącz Supabase, aby rozpocząć</h1>
      </div>
    )
  }

  const query = await searchParams
  const returnTo = getSafeAuthReturnTo(query.next)

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <ResetPasswordForm returnToPath={returnTo} />
    </div>
  )
}
