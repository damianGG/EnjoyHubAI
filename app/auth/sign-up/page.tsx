import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import SignUpForm from "@/components/sign-up-form"
import { getSafeAuthReturnTo } from "@/lib/auth/return-to"

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
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
  const [{ data: { user } }, query] = await Promise.all([
    supabase.auth.getUser(),
    searchParams,
  ])
  const returnTo = getSafeAuthReturnTo(query.next)

  // Authenticated users should still continue to the requested safe route.
  if (user) {
    redirect(returnTo)
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <SignUpForm returnToPath={returnTo} />
    </div>
  )
}
