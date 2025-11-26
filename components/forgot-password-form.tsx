"use client"

import { useActionState } from "react"
import { useFormStatus } from "react-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, ArrowLeft, Mail, CheckCircle } from "lucide-react"
import Link from "next/link"
import { requestPasswordReset } from "@/lib/actions"

interface ForgotPasswordFormProps {
  inline?: boolean
  onSwitchToLogin?: () => void
}

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Wysyłanie...
        </>
      ) : (
        <>
          <Mail className="mr-2 h-4 w-4" />
          Wyślij link do resetowania
        </>
      )}
    </Button>
  )
}

export default function ForgotPasswordForm({ inline = false, onSwitchToLogin }: ForgotPasswordFormProps = {}) {
  const [state, formAction] = useActionState(requestPasswordReset, null)

  const content = (
    <>
      {state?.ok ? (
        <div className="space-y-4">
          <div className="flex items-center justify-center">
            <div className="rounded-full bg-green-100 p-3">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </div>
          <div className="bg-green-500/10 border border-green-500/50 text-green-700 px-4 py-3 rounded text-center">
            {state.message}
          </div>
          <p className="text-sm text-muted-foreground text-center">
            Sprawdź swoją skrzynkę pocztową (w tym folder spam) i kliknij link w wiadomości.
          </p>
          <div className="text-center">
            {onSwitchToLogin ? (
              <button
                type="button"
                onClick={onSwitchToLogin}
                className="text-primary hover:underline inline-flex items-center"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Wróć do logowania
              </button>
            ) : (
              <Link href="/auth/login" className="text-primary hover:underline inline-flex items-center">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Wróć do logowania
              </Link>
            )}
          </div>
        </div>
      ) : (
        <form action={formAction} className="space-y-4">
          {state?.error && (
            <div className="bg-destructive/10 border border-destructive/50 text-destructive px-4 py-3 rounded">
              {state.error}
            </div>
          )}

          <p className="text-sm text-muted-foreground">
            Podaj adres email powiązany z Twoim kontem. Wyślemy Ci link do resetowania hasła.
          </p>

          <div className="space-y-2">
            <label htmlFor="email" className="block text-sm font-medium">
              Email
            </label>
            <Input id="email" name="email" type="email" placeholder="twoj@email.com" required />
          </div>

          <SubmitButton />

          <div className="text-center text-sm text-muted-foreground">
            Pamiętasz hasło?{" "}
            {onSwitchToLogin ? (
              <button
                type="button"
                onClick={onSwitchToLogin}
                className="text-primary hover:underline"
              >
                Zaloguj się
              </button>
            ) : (
              <Link href="/auth/login" className="text-primary hover:underline">
                Zaloguj się
              </Link>
            )}
          </div>
        </form>
      )}
    </>
  )

  if (inline) {
    return <div className="w-full">{content}</div>
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Zresetuj hasło</CardTitle>
        <CardDescription>Odzyskaj dostęp do swojego konta EnjoyHub</CardDescription>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  )
}
