"use client"

import { useActionState, useEffect } from "react"
import { useFormStatus } from "react-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { signIn, signInWithGoogle } from "@/lib/actions"
import { useT } from "@/components/i18n-provider"

interface LoginFormProps {
  inline?: boolean
  onSuccess?: () => void
  onSwitchToSignUp?: () => void
}

function SubmitButton() {
  const t = useT()
  const { pending } = useFormStatus()

  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {t("auth.login.submitting")}
        </>
      ) : (
        t("auth.login.submit")
      )}
    </Button>
  )
}

function GoogleSignInButton() {
  const t = useT()
  const { pending } = useFormStatus()

  return (
    <Button type="submit" variant="outline" disabled={pending} className="w-full bg-transparent">
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {t("auth.google_connecting")}
        </>
      ) : (
        <>
          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          {t("auth.google")}
        </>
      )}
    </Button>
  )
}

export default function LoginForm({ inline = false, onSuccess, onSwitchToSignUp }: LoginFormProps = {}) {
  const t = useT()
  const router = useRouter()
  const [state, formAction] = useActionState(signIn, null)

  // Handle successful login by redirecting or calling onSuccess
  useEffect(() => {
    if (state?.ok) {
      if (onSuccess) {
        onSuccess()
      } else {
        router.push("/")
      }
    }
  }, [state, router, onSuccess])

  const content = (
    <>
      <form action={signInWithGoogle} className="mb-4">
        <GoogleSignInButton />
      </form>

      <div className="relative mb-4">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">{t("common.or_continue_with")}</span>
        </div>
      </div>

      <form action={formAction} className="space-y-4">
        {state?.error && (
          <div className="bg-destructive/10 border border-destructive/50 text-destructive px-4 py-3 rounded">
            {state.error}
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="email" className="block text-sm font-medium">
            {t("auth.login.email")}
          </label>
          <Input id="email" name="email" type="email" placeholder={t("auth.login.email_placeholder")} required />
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="block text-sm font-medium">
            {t("auth.login.password")}
          </label>
          <Input id="password" name="password" type="password" required />
        </div>

        <SubmitButton />

        <div className="text-center text-sm text-muted-foreground">
          {t("auth.login.no_account")}{" "}
          {onSwitchToSignUp ? (
            <button
              type="button"
              onClick={onSwitchToSignUp}
              className="text-primary hover:underline"
            >
              {t("auth.login.signup_link")}
            </button>
          ) : (
            <Link href="/signup" className="text-primary hover:underline">
              {t("auth.login.signup_link")}
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
        <CardTitle className="text-2xl">{t("auth.login.title")}</CardTitle>
        <CardDescription>{t("auth.login.description")}</CardDescription>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  )
}
