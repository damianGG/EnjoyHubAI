import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

/**
 * Attributes API endpoint - fetches active attribute definitions
 * GET /api/attributes?category=paintball (optional)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')

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
            try {
              cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
            } catch {
              // The `setAll` method was called from a Server Component.
            }
          },
        },
      }
    )

    // Fetch attribute definitions
    // Global (category_slug IS NULL) OR matching category
    let query = supabase
      .from('attribute_definitions')
      .select('*')
      .eq('active', true)
      .order('sort_order', { ascending: true })

    if (category) {
      query = query.or(`category_slug.is.null,category_slug.eq.${category}`)
    } else {
      query = query.is('category_slug', null)
    }

    const { data, error } = await query

    if (error) {
      console.error("Attributes fetch error:", error)
      return NextResponse.json({ attributes: [], error: "Failed to fetch attributes" }, { status: 500 })
    }

    return NextResponse.json({ attributes: data || [] })
  } catch (error) {
    console.error("Attributes API error:", error)
    return NextResponse.json({ attributes: [], error: "Internal server error" }, { status: 500 })
  }
}
