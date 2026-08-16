import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { type NextRequest, NextResponse } from "next/server"

import { getSafeAuthReturnTo } from "@/lib/auth/return-to"

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const next = getSafeAuthReturnTo(requestUrl.searchParams.get("next"))

  if (!code) {
    return NextResponse.redirect(getLoginErrorUrl(requestUrl.origin, next))
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        },
      },
    },
  )

  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.user) {
    console.error("Auth callback exchange error:", error)
    return NextResponse.redirect(getLoginErrorUrl(requestUrl.origin, next))
  }

  const { data: existingUser, error: profileLookupError } = await supabase
    .from("users")
    .select("id")
    .eq("id", data.user.id)
    .maybeSingle()

  if (profileLookupError) {
    console.error("Auth callback profile lookup error:", profileLookupError)
  }

  if (!existingUser) {
    const { error: profileError } = await supabase.from("users").insert({
      id: data.user.id,
      email: data.user.email,
      full_name: data.user.user_metadata?.full_name || data.user.user_metadata?.name || "Użytkownik",
      is_host: Boolean(data.user.user_metadata?.is_host),
    })

    if (profileError) {
      console.error("Auth callback profile creation error:", profileError)
    }
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin))
}

function getLoginErrorUrl(origin: string, next: string) {
  const loginUrl = new URL("/auth/login", origin)
  loginUrl.searchParams.set("error", "callback")
  loginUrl.searchParams.set("next", next)
  return loginUrl
}
