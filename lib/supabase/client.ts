import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"

// Check if Supabase environment variables are available
export const isSupabaseConfigured =
  typeof process.env.NEXT_PUBLIC_SUPABASE_URL === "string" &&
  process.env.NEXT_PUBLIC_SUPABASE_URL.length > 0 &&
  typeof process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY === "string" &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length > 0

// Create a dummy client when Supabase is not configured (for build time)
const createDummyClient = () => {
  const createPromiseChain = (result: any) => {
    const promise = Promise.resolve(result)
    return {
      then: (fn: any) => createPromiseChain(fn(result)),
      catch: (fn: any) => createPromiseChain(result),
      finally: (fn: any) => {
        fn()
        return createPromiseChain(result)
      },
    }
  }

  return {
    auth: {
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      signOut: () => Promise.resolve({ error: null }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => {} } },
      }),
    },
    from: () => ({
      select: () => ({
        order: () => createPromiseChain({ data: [], error: null }),
      }),
    }),
  }
}

// Create a singleton instance of the Supabase client for Client Components
export function createClient() {
  if (!isSupabaseConfigured) {
    console.warn("Supabase environment variables are not set. Using dummy client.")
    return createDummyClient() as any
  }
  return createClientComponentClient()
}

export const supabase = createClient()
