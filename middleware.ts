import { updateSession } from "@/lib/supabase/middleware"
import type { NextRequest } from "next/server"

const NOINDEX_PREFIXES = [
  "/admin",
  "/api",
  "/auth",
  "/bilet",
  "/checkout",
  "/dashboard",
  "/host",
  "/opinia",
  "/przejmij-profil",
  "/widget",
  "/login",
  "/register",
  "/reset-password",
  "/forgot-password",
]

const CRAWLER_USER_AGENT = /bot|crawl|spider|slurp|bingpreview|oai-searchbot/i
const ATTRACTION_UUID = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i

function shouldNoIndex(pathname: string) {
  return NOINDEX_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

async function isSeoExcludedAttraction(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/attractions/")) return false
  if (!CRAWLER_USER_AGENT.test(request.headers.get("user-agent") || "")) return false

  const attractionId = request.nextUrl.pathname.match(ATTRACTION_UUID)?.[1]
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  if (!attractionId || !supabaseUrl || !anonKey) return false

  try {
    const endpoint = new URL("/rest/v1/properties", supabaseUrl)
    endpoint.searchParams.set("id", `eq.${attractionId}`)
    endpoint.searchParams.set("is_active", "eq.true")
    endpoint.searchParams.set("select", "seo_excluded")
    endpoint.searchParams.set("limit", "1")

    const response = await fetch(endpoint, {
      headers: {
        apikey: anonKey,
        authorization: `Bearer ${anonKey}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(2500),
    })

    if (!response.ok) return false
    const rows = await response.json() as Array<{ seo_excluded?: boolean | null }>
    return Boolean(rows[0]?.seo_excluded)
  } catch {
    return false
  }
}

export async function middleware(request: NextRequest) {
  const response = await updateSession(request)

  if (shouldNoIndex(request.nextUrl.pathname)) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive")
    return response
  }

  if (await isSeoExcludedAttraction(request)) {
    response.headers.set("X-Robots-Tag", "noindex, follow, noarchive")
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
