import "server-only"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"

export const isPublicSupabaseConfigured =
  typeof process.env.NEXT_PUBLIC_SUPABASE_URL === "string"
  && process.env.NEXT_PUBLIC_SUPABASE_URL.length > 0
  && typeof process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY === "string"
  && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length > 0

export function createPublicServerClient(): SupabaseClient | null {
  if (!isPublicSupabaseConfigured) return null

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    },
  )
}
