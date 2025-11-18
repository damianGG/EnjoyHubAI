import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs"
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

  const res = NextResponse.next()

  const supabase = createMiddlewareClient({ req: request, res })

  // Check if this is an auth callback
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")

  if (code) {
    try {
      // Exchange the code for a session
      await supabase.auth.exchangeCodeForSession(code)
      // Redirect to home page after successful auth
      return NextResponse.redirect(new URL("/", request.url))
    } catch (error) {
      console.error("[v0] Auth callback error:", error)
      // Redirect to login on error
      return NextResponse.redirect(new URL("/auth/login", request.url))
    }
  }

  try {
    // Refresh session if expired - required for Server Components
    await supabase.auth.getSession()
  } catch (error) {
    console.error("[v0] Session refresh error:", error)
    // Continue without throwing error
  }

  // Protected routes - redirect to login if not authenticated for host routes
  const isAuthRoute =
    request.nextUrl.pathname.startsWith("/auth/login") ||
    request.nextUrl.pathname.startsWith("/auth/sign-up") ||
    request.nextUrl.pathname === "/auth/callback"

  const isHostRoute = request.nextUrl.pathname.startsWith("/host")
  const isDashboardRoute = request.nextUrl.pathname.startsWith("/dashboard")

  if ((isHostRoute || isDashboardRoute) && !isAuthRoute) {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        // Redirect to home page instead of login page
        // The home page will detect the need for login and show the auth sheet
        const redirectUrl = new URL("/", request.url)
        redirectUrl.searchParams.set("login", "required")
        redirectUrl.searchParams.set("returnTo", request.nextUrl.pathname)
        return NextResponse.redirect(redirectUrl)
      }
    } catch (error) {
      console.error("[v0] Protected route auth check error:", error)
      // Redirect to home with login prompt on auth error
      const redirectUrl = new URL("/", request.url)
      redirectUrl.searchParams.set("login", "required")
      redirectUrl.searchParams.set("returnTo", request.nextUrl.pathname)
      return NextResponse.redirect(redirectUrl)
    }
  }

  return res
}
