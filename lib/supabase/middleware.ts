import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

// Check if Supabase environment variables are available
export const isSupabaseConfigured =
  typeof process.env.NEXT_PUBLIC_SUPABASE_URL === "string" &&
  process.env.NEXT_PUBLIC_SUPABASE_URL.length > 0 &&
  typeof process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY === "string" &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length > 0

export async function updateSession(request: NextRequest) {
  // If Supabase is not configured, just continue without auth
  if (!isSupabaseConfigured) {
    return NextResponse.next({
      request,
    })
  }

  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            supabaseResponse.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // The dedicated callback route exchanges login and sign-up codes and creates
  // the application profile. Middleware only handles recovery codes here.
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")

  if (code && request.nextUrl.pathname === "/auth/reset-password") {
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.error("[v0] Password recovery callback error:", error)
      return NextResponse.redirect(new URL("/auth/forgot-password?error=invalid-link", request.url))
    }

    const cleanUrl = request.nextUrl.clone()
    cleanUrl.searchParams.delete("code")
    const redirectResponse = NextResponse.redirect(cleanUrl)

    // Session cookies were written to supabaseResponse by the cookie adapter.
    // Preserve them on the redirect response.
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie)
    })

    return redirectResponse
  }

  if (request.nextUrl.pathname === "/auth/callback") {
    return supabaseResponse
  }

  let authenticatedUser = null

  try {
    // Validate the session with the Auth server and refresh cookies when needed.
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error) {
      console.error("[v0] Session validation error:", error)
    } else {
      authenticatedUser = user
    }
  } catch (error) {
    console.error("[v0] Session validation error:", error)
  }

  // Protected routes - redirect to login if not authenticated for host routes
  const isAuthRoute =
    request.nextUrl.pathname.startsWith("/auth/login") ||
    request.nextUrl.pathname.startsWith("/auth/sign-up") ||
    request.nextUrl.pathname === "/auth/callback"

  const isHostRoute = request.nextUrl.pathname.startsWith("/host")
  const isDashboardRoute = request.nextUrl.pathname.startsWith("/dashboard")

  if ((isHostRoute || isDashboardRoute) && !isAuthRoute) {
    if (!authenticatedUser) {
      const redirectUrl = new URL("/", request.url)
      redirectUrl.searchParams.set("login", "required")
      redirectUrl.searchParams.set("returnTo", request.nextUrl.pathname)
      return NextResponse.redirect(redirectUrl)
    }
  }

  return supabaseResponse
}
