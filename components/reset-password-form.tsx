"use client"

import { useActionState, useEffect, useState } from "react"
import { useFormStatus } from "react-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, CheckCircle, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { updatePassword } from "@/lib/actions"
import { createClient } from "@/lib/supabase/client"
import { getSafeAuthReturnTo } from "@/lib/auth/return-to"

interface ResetPasswordFormProps {
  returnToPath?: string | null
}

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Zapisywanie...
        </>
      ) : (
        <>
          <KeyRound className="mr-2 h-4 w-4" />
          Ustaw nowe hasło
        </>
      )}
    </Button>
  )
}

export default function ResetPasswordForm({ returnToPath }: ResetPasswordFormProps) {
  const router = useRouter()
  const [state, formAction] = useActionState(updatePassword, null)
  const [isValidToken, setIsValidToken] = useState<boolean | null>(null)
  const [tokenError, setTokenError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const destination = getSafeAuthReturnTo(returnToPath)
  const loginHref = `/auth/login?next=${encodeURIComponent(destination)}`
  const forgotHref = `/auth/forgot-password?next=${encodeURIComponent(destination)}`

  useEffect(() => {
    const validateRecoverySession = async () => {
      const supabase = createClient()

      // Current SSR/PKCE flow exchanges ?code=... in middleware before this page
      // renders. Keep hash-token handling only as a backwards-compatible fallback.
      const hash = window.location.hash
      if (hash.includes("access_token")) {
        const params = new URLSearchParams(hash.substring(1))
        const accessToken = params.get("access_token")
        const refreshToken = params.get("refresh_token")
        const type = params.get("type")

        if (type !== "recovery" || !accessToken) {
          setTokenError("Nieprawidłowy link do resetowania hasła.")
          setIsValidToken(false)
          return
        }

        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken ?? "",
        })

        if (error) {
          setTokenError("Link do resetowania hasła wygasł lub jest nieprawidłowy.")
          setIsValidToken(false)
          return
        }

        window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`)
      }

      const { data: { user }, error } = await supabase.auth.getUser()
      if (error || !user) {
        setTokenError("Link do resetowania hasła wygasł lub jest nieprawidłowy. Poproś o nowy link.")
        setIsValidToken(false)
        return
      }

      setIsValidToken(true)
    }

    validateRecoverySession().catch(() => {
      setTokenError("Wystąpił błąd podczas weryfikacji linku.")
      setIsValidToken(false)
    })
  }, [])

  useEffect(() => {
    if (!state?.ok) return

    const timer = setTimeout(() => {
      router.replace(loginHref)
      router.refresh()
    }, 2000)

    return () => clearTimeout(timer)
  }, [state, router, loginHref])

  if (isValidToken === null) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Ustaw nowe hasło</CardTitle>
          <CardDescription>Weryfikujemy bezpieczny link...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!isValidToken) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Ustaw nowe hasło</CardTitle>
          <CardDescription>Nie udało się zweryfikować linku</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-center">
              <div className="rounded-full bg-destructive/10 p-3">
                <AlertCircle className="h-8 w-8 text-destructive" />
              </div>
            </div>
            <div className="rounded border border-destructive/50 bg-destructive/10 px-4 py-3 text-center text-destructive">
              {tokenError}
            </div>
            <div className="text-center">
              <Link href={forgotHref} className="text-primary hover:underline">
                Wyślij nowy link do resetowania
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Ustaw nowe hasło</CardTitle>
        <CardDescription>Wprowadź nowe hasło dla swojego konta EnjoyHub</CardDescription>
      </CardHeader>
      <CardContent>
        {state?.ok ? (
          <div className="space-y-4">
            <div className="flex items-center justify-center">
              <div className="rounded-full bg-green-100 p-3">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </div>
            <div className="rounded border border-green-500/50 bg-green-500/10 px-4 py-3 text-center text-green-700">
              {state.message}
            </div>
            <p className="text-center text-sm text-muted-foreground">
              Za chwilę przejdziesz do logowania, a po zalogowaniu wrócisz tam, gdzie byłeś.
            </p>
            <div className="text-center">
              <Link href={loginHref} className="text-primary hover:underline">
                Przejdź do logowania
              </Link>
            </div>
          </div>
        ) : (
          <form action={formAction} className="space-y-4">
            {state?.error && (
              <div className="rounded border border-destructive/50 bg-destructive/10 px-4 py-3 text-destructive">
                {state.error}
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-medium">
                Nowe hasło
              </label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Minimum 8 znaków"
                  className="pr-11"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Ukryj hasło" : "Pokaż hasło"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">Hasło musi mieć co najmniej 8 znaków.</p>
            </div>

            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="block text-sm font-medium">
                Potwierdź nowe hasło
              </label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmation ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Powtórz hasło"
                  className="pr-11"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmation((current) => !current)}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground hover:text-foreground"
                  aria-label={showConfirmation ? "Ukryj hasło" : "Pokaż hasło"}
                >
                  {showConfirmation ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <SubmitButton />

            <div className="text-center text-sm text-muted-foreground">
              <Link href={loginHref} className="text-primary hover:underline">
                Wróć do logowania
              </Link>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
