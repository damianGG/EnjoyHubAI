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
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )
}

type ActionResult = {
  ok?: boolean
  message?: string
  error?: string
  requiresEmailConfirmation?: boolean
}

function validateEmail(e: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
}

function getSiteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "")
}

function getAuthCallbackUrl() {
  return process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL || `${getSiteUrl()}/auth/callback`
}

function getSignInErrorMessage(code?: string) {
  switch (code) {
    case "email_not_confirmed":
      return "Adres email nie został jeszcze potwierdzony. Sprawdź swoją skrzynkę odbiorczą."
    case "over_request_rate_limit":
      return "Wykonano zbyt wiele prób logowania. Odczekaj chwilę i spróbuj ponownie."
    case "user_banned":
      return "To konto zostało zablokowane. Skontaktuj się z obsługą."
    case "invalid_credentials":
    default:
      return "Nieprawidłowy email lub hasło"
  }
}

function getSignUpErrorMessage(code?: string) {
  switch (code) {
    case "email_exists":
    case "user_already_exists":
      return "Konto z tym adresem email już istnieje. Spróbuj się zalogować."
    case "email_address_invalid":
      return "Ten adres email nie może zostać użyty. Wprowadź inny adres."
    case "email_address_not_authorized":
      return "Wysyłanie wiadomości na ten adres email nie jest obecnie dozwolone."
    case "weak_password":
      return "Hasło nie spełnia wymagań bezpieczeństwa. Użyj silniejszego hasła."
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Wykonano zbyt wiele prób rejestracji. Odczekaj chwilę i spróbuj ponownie."
    case "signup_disabled":
    case "email_provider_disabled":
      return "Rejestracja za pomocą adresu email jest obecnie niedostępna."
    default:
      return "Rejestracja nie powiodła się. Spróbuj ponownie."
  }
}

// Sign in action
export async function signIn(prevState: any, formData: FormData): Promise<ActionResult> {
  if (!formData) return { error: "Brak danych formularza" }

  const email = formData.get("email")
  const password = formData.get("password")

  if (!email || !password) return { error: "Email i hasło są wymagane" }

  const emailStr = String(email).trim()
  const passwordStr = String(password)

  if (!validateEmail(emailStr)) return { error: "Nieprawidłowy adres email" }
  if (passwordStr.length < 8) return { error: "Hasło musi mieć co najmniej 8 znaków" }

  try {
    const supabase = await createSupabaseServerClient()
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailStr,
      password: passwordStr,
    })

    if (error) {
      console.error("Sign in error:", error)
      return { error: getSignInErrorMessage(error.code) }
    }

    console.log("Sign in successful for user:", data?.user?.email)
    return { ok: true, message: "Zalogowano pomyślnie" }
  } catch (err) {
    console.error("Login error:", err)
    return { error: "Wystąpił nieoczekiwany błąd. Spróbuj ponownie." }
  }
}

// Sign up action
export async function signUp(prevState: any, formData: FormData): Promise<ActionResult> {
  if (!formData) return { error: "Brak danych formularza" }

  const email = formData.get("email")
  const password = formData.get("password")
  const confirmPassword = formData.get("confirmPassword")
  const fullName = formData.get("fullName")
  const isHost = formData.get("isHost") === "on"

  if (!email || !password || !confirmPassword || !fullName) {
    return { error: "Email, hasło, potwierdzenie hasła oraz imię i nazwisko są wymagane" }
  }

  const emailStr = String(email).trim()
  const passwordStr = String(password)
  const confirmPasswordStr = String(confirmPassword)
  const fullNameStr = String(fullName).trim()

  if (!validateEmail(emailStr)) return { error: "Nieprawidłowy adres email" }
  if (fullNameStr.length < 2) return { error: "Imię i nazwisko musi zawierać co najmniej 2 znaki" }
  if (passwordStr.length < 8) return { error: "Hasło musi mieć co najmniej 8 znaków" }
  if (passwordStr !== confirmPasswordStr) return { error: "Hasła nie są identyczne" }

  const supabase = await createSupabaseServerClient()

  try {
    const { data, error } = await supabase.auth.signUp({
      email: emailStr,
      password: passwordStr,
      options: {
        emailRedirectTo: getAuthCallbackUrl(),
        data: {
          full_name: fullNameStr,
          is_host: isHost,
        },
      },
    })

    if (error) {
      console.error("Sign up error (provider):", error)
      return { error: getSignUpErrorMessage(error.code) }
    }

    // With email confirmation enabled there is no authenticated session yet, so the
    // callback creates the profile after confirmation. Without confirmation we can
    // create it immediately.
    if (data?.session && data.user?.id) {
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

    const requiresEmailConfirmation = !data.session

    return {
      ok: true,
      requiresEmailConfirmation,
      message: requiresEmailConfirmation
        ? "Sprawdź skrzynkę email, aby potwierdzić konto."
        : "Konto zostało utworzone i jesteś już zalogowany.",
    }
  } catch (err) {
    console.error("Sign up error:", err)
    return { error: "Wystąpił nieoczekiwany błąd. Spróbuj ponownie." }
  }
}

// Sign out action
export async function signOut() {
  const supabase = await createSupabaseServerClient()

  await supabase.auth.signOut()
  redirect("/auth/login")
}

// Google OAuth sign in action
async function signInWithOAuth(provider: "google" | "facebook"): Promise<void> {
  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: getAuthCallbackUrl(),
    },
  })

  if (error) {
    console.error(`${provider} OAuth error:`, error)
    redirect("/auth/login?error=oauth")
  }

  if (data?.url) {
    redirect(data.url)
  }

  redirect("/auth/login?error=oauth")
}

// OAuth sign-in actions must resolve to void when used as form actions.
export async function signInWithGoogle(): Promise<void> {
  return signInWithOAuth("google")
}

export async function signInWithFacebook(): Promise<void> {
  return signInWithOAuth("facebook")
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

// Phone authentication - Send OTP via SMSApi
export async function sendPhoneOTP(prevState: any, formData: FormData): Promise<ActionResult> {
  if (!formData) return { error: "Brak danych formularza" }

  const phone = formData.get("phone")

  if (!phone) return { error: "Numer telefonu jest wymagany" }

  const phoneStr = String(phone).replace(/[\s()-]/g, "")

  // Basic phone validation (accepts international format)
  if (!/^\+?[1-9]\d{1,14}$/.test(phoneStr.replace(/[\s-]/g, ""))) {
    return { error: "Nieprawidłowy numer telefonu" }
  }

  const supabase = await createSupabaseServerClient()

  try {
    const { error } = await supabase.auth.signInWithOtp({
      phone: phoneStr,
    })

    if (error) {
      console.error("Phone OTP error:", error)
      if (error.code === "over_sms_send_rate_limit" || error.code === "over_request_rate_limit") {
        return { error: "Wysłano zbyt wiele kodów. Odczekaj chwilę i spróbuj ponownie." }
      }
      return { error: "Nie udało się wysłać kodu SMS. Spróbuj ponownie." }
    }

    return { ok: true, message: "Kod weryfikacyjny został wysłany na Twój numer telefonu." }
  } catch (err) {
    console.error("Phone OTP error:", err)
    return { error: "Wystąpił nieoczekiwany błąd. Spróbuj ponownie." }
  }
}

// Phone authentication - Verify OTP
export async function verifyPhoneOTP(prevState: any, formData: FormData): Promise<ActionResult> {
  if (!formData) return { error: "Brak danych formularza" }

  const phone = formData.get("phone")
  const token = formData.get("token")

  if (!phone || !token) return { error: "Numer telefonu i kod weryfikacyjny są wymagane" }

  const phoneStr = String(phone).trim()
  const tokenStr = String(token).trim()

  if (tokenStr.length !== 6 || !/^\d{6}$/.test(tokenStr)) {
    return { error: "Kod weryfikacyjny musi składać się z 6 cyfr" }
  }

  const supabase = await createSupabaseServerClient()

  try {
    const { data, error } = await supabase.auth.verifyOtp({
      phone: phoneStr,
      token: tokenStr,
      type: "sms",
    })

    if (error) {
      console.error("Phone OTP verification error:", error)
      if (error.code === "otp_expired") {
        return { error: "Kod weryfikacyjny wygasł. Wyślij nowy kod i spróbuj ponownie." }
      }
      return { error: "Nieprawidłowy kod weryfikacyjny lub kod wygasł" }
    }

    // Update user profile with phone number if this is a new user
    if (data?.user?.id) {
      const { error: profileError } = await supabase
        .from("users")
        .upsert(
          {
            id: data.user.id,
            phone: phoneStr,
            email: data.user.email || `noemail+${data.user.id}@enjoyhub.local`, // Fallback email for phone-only users
          },
          { onConflict: "id" },
        )

      if (profileError) console.error("Profile update error:", profileError)
    }

    return { ok: true, message: "Pomyślnie zalogowano" }
  } catch (err) {
    console.error("Phone OTP verification error:", err)
    return { error: "Wystąpił nieoczekiwany błąd. Spróbuj ponownie." }
  }
}
