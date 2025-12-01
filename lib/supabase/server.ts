import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

// Check if Supabase environment variables are available
export const isSupabaseConfigured =
  typeof process.env.NEXT_PUBLIC_SUPABASE_URL === "string" &&
  process.env.NEXT_PUBLIC_SUPABASE_URL.length > 0 &&
  typeof process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY === "string" &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length > 0

// Create a Supabase client for Server Components
export async function createClient() {
  const cookieStore = await cookies()

  if (!isSupabaseConfigured) {
    console.warn("Supabase environment variables are not set. Using dummy client.")
    // Return a more complete dummy client
    const createPromiseChain = (result: any) => {
      return {
        then: (fn: any) => createPromiseChain(fn ? fn(result) : result),
        catch: () => createPromiseChain(result),
        finally: (fn: any) => {
          if (fn) fn()
          return createPromiseChain(result)
        },
      }
    }
    
    return {
      auth: {
        getUser: () => Promise.resolve({ data: { user: null }, error: null }),
        getSession: () => Promise.resolve({ data: { session: null }, error: null }),
        signInWithPassword: () => Promise.resolve({ data: null, error: { message: "Supabase not configured" } }),
        signUp: () => Promise.resolve({ data: null, error: { message: "Supabase not configured" } }),
        signOut: () => Promise.resolve({ error: null }),
        resetPasswordForEmail: () => Promise.resolve({ data: null, error: null }),
        updateUser: () => Promise.resolve({ data: null, error: { message: "Supabase not configured" } }),
        signInWithOAuth: () => Promise.resolve({ data: null, error: { message: "Supabase not configured" } }),
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: null, error: null }),
            order: () => createPromiseChain({ data: [], error: null }),
          }),
          in: () => ({
            order: () => createPromiseChain({ data: [], error: null }),
          }),
          order: () => createPromiseChain({ data: [], error: null }),
          range: () => Promise.resolve({ data: [], error: null, count: 0 }),
          gte: () => ({
            lte: () => ({
              gte: () => ({
                lte: () => Promise.resolve({ data: [], error: null, count: 0 }),
              }),
            }),
          }),
          ilike: () => ({
            in: () => ({
              gte: () => ({
                lte: () => ({
                  gte: () => ({
                    lte: () => ({
                      order: () => ({
                        range: () => Promise.resolve({ data: [], error: null, count: 0 }),
                      }),
                    }),
                  }),
                }),
              }),
            }),
            order: () => ({
              range: () => Promise.resolve({ data: [], error: null, count: 0 }),
            }),
          }),
        }),
        insert: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: null, error: null }),
          }),
        }),
        update: () => ({
          eq: () => Promise.resolve({ data: null, error: null }),
        }),
        delete: () => ({
          eq: () => Promise.resolve({ data: null, error: null }),
        }),
        upsert: () => Promise.resolve({ data: null, error: null }),
      }),
    } as any
  }

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}
