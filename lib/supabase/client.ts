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

// Clear old auth-helpers storage keys that are incompatible with @supabase/ssr
const clearLegacyAuthStorage = () => {
  if (!isBrowser) return
  
  try {
    // Clear old supabase auth keys from localStorage that use the old format
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('sb-') && key.includes('-auth-token')) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach(key => {
      console.log('Clearing legacy auth storage key:', key)
      localStorage.removeItem(key)
    })
  } catch (error) {
    console.warn('Failed to clear legacy auth storage:', error)
  }
}

// Create a new instance of the Supabase client for Client Components
// This should be called inside useEffect or event handlers to ensure it runs on the client
export function createClient() {
  // Clear legacy storage on first load
  if (isBrowser) {
    clearLegacyAuthStorage()
  }

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
  
  // During SSR, return dummy client
  console.warn("Supabase client should only be created in the browser. Using dummy client.")
  return createDummyClient() as any
}

// Legacy export - prefer using createClient() inside useEffect
export const supabase = createClient()
