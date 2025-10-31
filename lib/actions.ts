"use server"

import { createServerActionClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

function createSupabaseServerClient() {
  const cookieStore = cookies()
  return createServerActionClient({ cookies: () => cookieStore })
}

// Sign in action
export async function signIn(prevState: any, formData: FormData) {
  if (!formData) {
    return { error: "Form data is missing" }
  }

  const email = formData.get("email")
  const password = formData.get("password")

  if (!email || !password) {
    return { error: "Email and password are required" }
  }

  const supabase = createSupabaseServerClient()

  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.toString(),
      password: password.toString(),
    })

    if (error) {
      return { error: error.message }
    }

    return { success: true }
  } catch (error) {
    console.error("Login error:", error)
    return { error: "An unexpected error occurred. Please try again." }
  }
}

// Sign up action
export async function signUp(prevState: any, formData: FormData) {
  if (!formData) {
    return { error: "Form data is missing" }
  }

  const email = formData.get("email")
  const password = formData.get("password")
  const fullName = formData.get("fullName")
  const isHost = formData.get("isHost") === "on"

  if (!email || !password || !fullName) {
    return { error: "Email, password and full name are required" }
  }

  const supabase = createSupabaseServerClient()

  try {
    const { data, error } = await supabase.auth.signUp({
      email: email.toString(),
      password: password.toString(),
      options: {
        emailRedirectTo:
          process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL || `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
        data: {
          full_name: fullName.toString(),
          is_host: isHost,
        },
      },
    })

    if (error) {
      return { error: error.message }
    }

    // Create user profile in our users table
    if (data.user) {
      const { error: profileError } = await supabase.from("users").insert({
        id: data.user.id,
        email: data.user.email,
        full_name: fullName.toString(),
        is_host: isHost,
      })

      if (profileError) {
        console.error("Profile creation error:", profileError)
      }
    }

    return { success: "Check your email to confirm your account." }
  } catch (error) {
    console.error("Sign up error:", error)
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
    return { error: error.message }
  }

  if (data.url) {
    redirect(data.url)
  }
}
