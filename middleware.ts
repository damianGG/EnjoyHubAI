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

function shouldNoIndex(pathname: string) {
  return NOINDEX_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

export async function middleware(request: NextRequest) {
  const response = await updateSession(request)

  if (shouldNoIndex(request.nextUrl.pathname)) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive")
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
