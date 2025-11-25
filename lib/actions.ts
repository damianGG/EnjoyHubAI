"use server"

import { createServerActionClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

function createSupabaseServerClient() {
  const cookieStore = cookies()
  return createServerActionClient({ cookies: () => cookieStore })
}

type ActionResult = { ok?: boolean; message?: string; error?: string }

function validateEmail(e: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
}

// Sign in action
export async function signIn(prevState: any, formData: FormData): Promise<ActionResult> {
  if (!formData) return { error: "Form data is missing" }

  const email = formData.get("email")
  const password = formData.get("password")

  if (!email || !password) return { error: "Email and password are required" }

  const emailStr = String(email).trim()
  const passwordStr = String(password)

  if (!validateEmail(emailStr)) return { error: "Invalid email" }
  if (passwordStr.length < 8) return { error: "Password must be at least 8 characters" }

  const supabase = createSupabaseServerClient()

  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: emailStr,
      password: passwordStr,
    })

    if (error) {
      // Avoid leaking provider internals; give a friendly message
      return { error: "Invalid credentials or account not confirmed" }
    }

    return { ok: true, message: "Signed in" }
  } catch (err) {
    console.error("Login error:", err)
    return { error: "An unexpected error occurred. Please try again." }
  }
}

// Sign up action
export async function signUp(prevState: any, formData: FormData): Promise<ActionResult> {
  if (!formData) return { error: "Form data is missing" }

  const email = formData.get("email")
  const password = formData.get("password")
  const fullName = formData.get("fullName")
  const isHost = formData.get("isHost") === "on"

  if (!email || !password || !fullName) return { error: "Email, password and full name are required" }

  const emailStr = String(email).trim()
  const passwordStr = String(password)
  const fullNameStr = String(fullName).trim()

  if (!validateEmail(emailStr)) return { error: "Invalid email" }
  if (passwordStr.length < 8) return { error: "Password must be at least 8 characters" }

  const supabase = createSupabaseServerClient()

  try {
    const { data, error } = await supabase.auth.signUp({
      email: emailStr,
      password: passwordStr,
      options: {
        emailRedirectTo:
          process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL || `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
        data: {
          full_name: fullNameStr,
          is_host: isHost,
        },
      },
    })

    if (error) {
      console.error("Sign up error (provider):", error)
      return { error: "Sign up failed. Please try again." }
    }

    // If a user object was returned (depends on confirmation settings), upsert profile to avoid conflicts with DB trigger
    if (data?.user?.id) {
      const { error: profileError } = await supabase
        .from("users")
        .upsert(
          {
            id: data.user.id,
            email: data.user.email,
            full_name: fullNameStr,
            is_host: isHost,
          },
          { onConflict: "id" },
        )

      if (profileError) console.error("Profile creation error:", profileError)
    }

    return { ok: true, message: "Check your email to confirm your account." }
  } catch (err) {
    console.error("Sign up error:", err)
    return { error: "An unexpected error occurred. Please try again." }
  }
}

// Sign out action
export async function signOut() {
  const supabase = createSupabaseServerClient()

  await supabase.auth.signOut()
  redirect("/auth/login")
}

// Google OAuth sign in action
export async function signInWithGoogle() {
  const supabase = createSupabaseServerClient()

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/auth/callback`,
    },
  })

  if (error) {
    console.error("Google OAuth error:", error)
    return { error: "OAuth sign-in failed" }
  }

  if (data?.url) {
    redirect(data.url)
  }
}

// Facebook OAuth sign in action
export async function signInWithFacebook() {
  const supabase = createSupabaseServerClient()

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "facebook",
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/auth/callback`,
    },
  })

  if (error) {
    console.error("Facebook OAuth error:", error)
    return { error: "OAuth sign-in failed" }
  }

  if (data?.url) {
    redirect(data.url)
  }
}

// Instagram OAuth sign in action (Instagram uses Facebook's OAuth)
export async function signInWithInstagram() {
  const supabase = createSupabaseServerClient()

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "facebook",
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/auth/callback`,
      scopes: "instagram_basic",
    },
  })

  if (error) {
    console.error("Instagram OAuth error:", error)
    return { error: "OAuth sign-in failed" }
  }

  if (data?.url) {
    redirect(data.url)
  }
}