import { createBrowserClient } from "@supabase/ssr"

// Check if we're in the browser
const isBrowser = typeof window !== "undefined"

// Check if Supabase environment variables are available
// This check should only be used at runtime, not during SSR/build
export const isSupabaseConfigured = () => {
  // During SSR or build, assume Supabase is configured (actual check happens at runtime)
  if (!isBrowser) {
    return true
  }
  
  // On the client, check if the env vars were properly injected at build time
  return (
    typeof process.env.NEXT_PUBLIC_SUPABASE_URL === "string" &&
    process.env.NEXT_PUBLIC_SUPABASE_URL.length > 0 &&
    typeof process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY === "string" &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length > 0
  )
}

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

// Create a new instance of the Supabase client for Client Components
// This should be called inside useEffect or event handlers to ensure it runs on the client
export function createClient() {
  // In the browser, always try to create the real client
  // The environment variables should be embedded in the client bundle at build time
  if (isBrowser) {
    try {
      return createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
    } catch (error) {
      console.warn("Failed to create Supabase client:", error)
      return createDummyClient() as any
    }
  }
  
  // During SSR, create a real client if env vars are available
  if (
    typeof process.env.NEXT_PUBLIC_SUPABASE_URL === "string" &&
    process.env.NEXT_PUBLIC_SUPABASE_URL.length > 0 &&
    typeof process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY === "string" &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length > 0
  ) {
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )
  }
  
  console.warn("Supabase environment variables are not set. Using dummy client.")
  return createDummyClient() as any
}

// Legacy export - prefer using createClient() inside useEffect
export const supabase = createClient()
