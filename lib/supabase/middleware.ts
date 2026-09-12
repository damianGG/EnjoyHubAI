import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

// Check if Supabase environment variables are available
export const isSupabaseConfigured =
  typeof process.env.NEXT_PUBLIC_SUPABASE_URL === "string" &&
  process.env.NEXT_PUBLIC_SUPABASE_URL.length > 0 &&
  typeof process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY === "string" &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length > 0

function isExpectedMissingSession(error: unknown) {
  return Boolean(
    error
    && typeof error === "object"
    && "name" in error
    && error.name === "AuthSessionMissingError",
  )
}

export async function updateSession(request: NextRequest) {
  // If Supabase is not configured, just continue without auth
  if (!isSupabaseConfigured) {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

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
    },
  )

  // Password recovery links use token_hash instead of relying on a PKCE verifier
  // cookie. This makes reset links work when the e-mail is opened in another
  // browser/device or on a different approved application hostname. Keep the
  // legacy ?code=... path as a backwards-compatible fallback for older e-mails.
  const requestUrl = new URL(request.url)
  const isResetPasswordRoute = request.nextUrl.pathname === "/auth/reset-password"
  const tokenHash = requestUrl.searchParams.get("token_hash")
  const recoveryType = requestUrl.searchParams.get("type")
  const code = requestUrl.searchParams.get("code")

  if (isResetPasswordRoute && tokenHash && recoveryType === "recovery") {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: "recovery",
    })

    if (error) {
      console.error("[v0] Password recovery token verification error:", error)
      return NextResponse.redirect(new URL("/auth/forgot-password?error=invalid-link", request.url))
    }

    const cleanUrl = request.nextUrl.clone()
    cleanUrl.searchParams.delete("token_hash")
    cleanUrl.searchParams.delete("type")
    const redirectResponse = NextResponse.redirect(cleanUrl)

    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie)
    })

    return redirectResponse
  }

  if (isResetPasswordRoute && code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.error("[v0] Password recovery callback error:", error)
      return NextResponse.redirect(new URL("/auth/forgot-password?error=invalid-link", request.url))
    }

    const cleanUrl = request.nextUrl.clone()
    cleanUrl.searchParams.delete("code")
    const redirectResponse = NextResponse.redirect(cleanUrl)

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
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error) {
      // An unauthenticated visitor has no Supabase session. That is normal for
      // public pages and protected-route redirects, so it must not pollute
      // production error telemetry.
      if (!isExpectedMissingSession(error)) {
        console.error("[v0] Session validation error:", error)
      }
    } else {
      authenticatedUser = user
    }
  } catch (error) {
    if (!isExpectedMissingSession(error)) {
      console.error("[v0] Session validation error:", error)
    }
  }

  const isAuthRoute =
    request.nextUrl.pathname.startsWith("/auth/login") ||
    request.nextUrl.pathname.startsWith("/auth/sign-up") ||
    request.nextUrl.pathname === "/auth/callback"

  const isHostRoute = request.nextUrl.pathname.startsWith("/host")
  const isDashboardRoute = request.nextUrl.pathname.startsWith("/dashboard")
  const isAdminRoute = request.nextUrl.pathname.startsWith("/admin")

  if ((isHostRoute || isDashboardRoute || isAdminRoute) && !isAuthRoute && !authenticatedUser) {
    const redirectUrl = new URL("/", request.url)
    redirectUrl.searchParams.set("login", "required")
    redirectUrl.searchParams.set(
      "returnTo",
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    )
    return NextResponse.redirect(redirectUrl)
  }

  return supabaseResponse
}
