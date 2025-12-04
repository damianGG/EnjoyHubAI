"use server"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

async function createSupabaseServerClient() {
  const cookieStore = await cookies()
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
          }
        },
      },
    }
  )
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

  const supabase = await createSupabaseServerClient()

  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: emailStr,
      password: passwordStr,
    })

    if (error) {
      console.error("Sign in error:", error)
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

  const supabase = await createSupabaseServerClient()

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
  const supabase = await createSupabaseServerClient()

  await supabase.auth.signOut()
  redirect("/auth/login")
}

// Google OAuth sign in action
export async function signInWithGoogle() {
  const supabase = await createSupabaseServerClient()

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

// Request password reset action
export async function requestPasswordReset(prevState: any, formData: FormData): Promise<ActionResult> {
  if (!formData) return { error: "Brak danych formularza" }

  const email = formData.get("email")

  if (!email) return { error: "Email jest wymagany" }

  const emailStr = String(email).trim()

  if (!validateEmail(emailStr)) return { error: "Nieprawidłowy adres email" }

  const supabase = await createSupabaseServerClient()

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(emailStr, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/auth/reset-password`,
    })

    if (error) {
      console.error("Password reset request error:", error)
      // Don't reveal if email exists or not for security
      return { ok: true, message: "Jeśli konto z tym adresem email istnieje, otrzymasz link do resetowania hasła." }
    }

    return { ok: true, message: "Jeśli konto z tym adresem email istnieje, otrzymasz link do resetowania hasła." }
  } catch (err) {
    console.error("Password reset error:", err)
    return { error: "Wystąpił nieoczekiwany błąd. Spróbuj ponownie." }
  }
}

// Update password action (after clicking reset link)
export async function updatePassword(prevState: any, formData: FormData): Promise<ActionResult> {
  if (!formData) return { error: "Brak danych formularza" }

  const password = formData.get("password")
  const confirmPassword = formData.get("confirmPassword")

  if (!password || !confirmPassword) return { error: "Hasło i potwierdzenie hasła są wymagane" }

  const passwordStr = String(password)
  const confirmPasswordStr = String(confirmPassword)

  if (passwordStr.length < 8) return { error: "Hasło musi mieć co najmniej 8 znaków" }
  if (passwordStr !== confirmPasswordStr) return { error: "Hasła nie są identyczne" }

  const supabase = await createSupabaseServerClient()

  try {
    const { error } = await supabase.auth.updateUser({
      password: passwordStr,
    })

    if (error) {
      console.error("Password update error:", error)
      if (error.message.includes("expired") || error.message.includes("invalid")) {
        return { error: "Link do resetowania hasła wygasł lub jest nieprawidłowy. Poproś o nowy link." }
      }
      return { error: "Nie udało się zaktualizować hasła. Spróbuj ponownie." }
    }

    return { ok: true, message: "Hasło zostało zmienione. Możesz się teraz zalogować." }
  } catch (err) {
    console.error("Password update error:", err)
    return { error: "Wystąpił nieoczekiwany błąd. Spróbuj ponownie." }
  }
}