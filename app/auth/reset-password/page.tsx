import { isSupabaseConfigured } from "@/lib/supabase/server"
import ResetPasswordForm from "@/components/reset-password-form"

export default async function ResetPasswordPage() {
  // If Supabase is not configured, show setup message directly
  if (!isSupabaseConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <h1 className="text-2xl font-bold mb-4">Connect Supabase to get started</h1>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <ResetPasswordForm />
    </div>
  )
}
