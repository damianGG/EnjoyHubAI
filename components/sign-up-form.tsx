"use client"

import { useActionState, useEffect, useState } from "react"
import { useFormStatus } from "react-dom"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Loader2, MailCheck, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  resendSignUpConfirmation,
  signInWithFacebook,
  signInWithGoogle,
  signUp,
} from "@/lib/actions"
import { getSafeAuthReturnTo } from "@/lib/auth/return-to"

interface SignUpFormProps {
  inline?: boolean
  onSuccess?: () => void
  onSwitchToLogin?: () => void
  returnToPath?: string | null
}

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" disabled={pending} className="h-12 w-full rounded-2xl text-[15px] font-bold">
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Tworzenie konta...
        </>
      ) : (
        "Utwórz konto"
      )}
    </Button>
  )
}

function ResendButton() {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" variant="outline" disabled={pending} className="h-11 w-full rounded-2xl">
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Wysyłanie...
        </>
      ) : (
        <>
          <RefreshCw className="mr-2 h-4 w-4" />
          Wyślij link ponownie
        </>
      )}
    </Button>
  )
}

function GoogleSignInButton() {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" variant="outline" disabled={pending} className="h-12 w-full rounded-2xl bg-white">
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Łączenie z Google...
        </>
      ) : (
        <>
          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Kontynuuj z Google
        </>
      )}
    </Button>
  )
}

function FacebookSignInButton() {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" variant="outline" disabled={pending} className="h-12 w-full rounded-2xl bg-white">
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Łączenie z Facebookiem...
        </>
      ) : (
        <>
          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="#1877F2">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
          </svg>
          Kontynuuj z Facebookiem
        </>
      )}
    </Button>
  )
}

export default function SignUpForm({
  inline = false,
  onSuccess,
  onSwitchToLogin,
  returnToPath,
}: SignUpFormProps = {}) {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [state, formAction] = useActionState(signUp, null)
  const [resendState, resendAction] = useActionState(resendSignUpConfirmation, null)
  const destination = getSafeAuthReturnTo(returnToPath)
  const loginHref = `/auth/login?next=${encodeURIComponent(destination)}`

  useEffect(() => {
    if (state?.ok && !state.requiresEmailConfirmation) {
      if (onSuccess) {
        onSuccess()
      } else {
        router.push(destination)
        router.refresh()
      }
    }
  }, [state, router, onSuccess, destination])

  const content = state?.ok && state.requiresEmailConfirmation ? (
    <div className="space-y-5 text-center" aria-live="polite">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary/10">
        <MailCheck className="h-7 w-7 text-primary" />
      </div>

      <div className="space-y-2">
        <h2 className="text-xl font-extrabold tracking-[-0.025em]">Sprawdź swoją skrzynkę</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Wysłaliśmy link potwierdzający na{" "}
          <span className="font-semibold text-foreground">{state.email}</span>.
        </p>
        <p className="text-xs leading-5 text-muted-foreground">
          Kliknij link w wiadomości. Zalogujemy Cię i wrócisz automatycznie do EnjoyHub. Jeśli wiadomości nie ma, sprawdź folder spam.
        </p>
      </div>

      <form action={resendAction} className="space-y-2">
        <input type="hidden" name="email" value={state.email || ""} />
        <input type="hidden" name="next" value={destination} />
        <ResendButton />
        {resendState?.message && !resendState.error && (
          <p className="text-xs font-medium text-green-700">{resendState.message}</p>
        )}
        {resendState?.error && <p className="text-xs font-medium text-destructive">{resendState.error}</p>}
      </form>

      {onSwitchToLogin ? (
        <button type="button" onClick={onSwitchToLogin} className="text-sm font-semibold text-primary hover:underline">
          Mam już potwierdzone konto — zaloguj się
        </button>
      ) : (
        <Link href={loginHref} className="text-sm font-semibold text-primary hover:underline">
          Mam już potwierdzone konto — zaloguj się
        </Link>
      )}
    </div>
  ) : (
    <>
      <form action={signInWithGoogle} className="mb-2">
        <input type="hidden" name="next" value={destination} />
        <GoogleSignInButton />
      </form>

      <form action={signInWithFacebook} className="mb-4">
        <input type="hidden" name="next" value={destination} />
        <FacebookSignInButton />
      </form>

      <div className="relative mb-5">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-[11px] uppercase tracking-[0.08em]">
          <span className="bg-white px-3 text-muted-foreground">albo przez email</span>
        </div>
      </div>

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="next" value={destination} />

        {state?.error && (
          <div role="alert" aria-live="polite" className="rounded-2xl border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm text-destructive">
            {state.error}
          </div>
        )}

        <div className="space-y-1.5">
          <label htmlFor="fullName" className="block text-sm font-semibold">
            Imię i nazwisko
          </label>
          <Input
            id="fullName"
            name="fullName"
            type="text"
            placeholder="Jan Kowalski"
            autoComplete="name"
            minLength={2}
            maxLength={120}
            className="h-12 rounded-2xl"
            required
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="email" className="block text-sm font-semibold">
            Email
          </label>
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            placeholder="twoj@email.com"
            autoComplete="email"
            className="h-12 rounded-2xl"
            required
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="block text-sm font-semibold">
            Hasło
          </label>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              minLength={8}
              className="h-12 rounded-2xl pr-12"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-1 top-1 grid h-10 w-10 place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={showPassword ? "Ukryj hasło" : "Pokaż hasło"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">Minimum 8 znaków. Nie używaj hasła z innego serwisu.</p>
        </div>

        <SubmitButton />

        <p className="text-center text-[11px] leading-5 text-muted-foreground">
          Tworząc konto, potwierdzasz zapoznanie się z{" "}
          <Link href="/privacy" target="_blank" className="font-medium text-foreground underline underline-offset-2">
            Polityką prywatności
          </Link>.
        </p>

        <div className="text-center text-sm text-muted-foreground">
          Masz już konto?{" "}
          {onSwitchToLogin ? (
            <button type="button" onClick={onSwitchToLogin} className="font-semibold text-primary hover:underline">
              Zaloguj się
            </button>
          ) : (
            <Link href={loginHref} className="font-semibold text-primary hover:underline">
              Zaloguj się
            </Link>
          )}
        </div>
      </form>
    </>
  )

  if (inline) {
    return <div className="w-full">{content}</div>
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Utwórz konto</CardTitle>
        <CardDescription>Rezerwuj atrakcje szybciej i miej bilety zawsze pod ręką.</CardDescription>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  )
}
