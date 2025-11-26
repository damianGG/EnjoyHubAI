"use client"

import { useActionState, useEffect } from "react"
import { useFormStatus } from "react-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, CheckCircle, KeyRound } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { updatePassword } from "@/lib/actions"

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

export default function ResetPasswordForm() {
  const router = useRouter()
  const [state, formAction] = useActionState(updatePassword, null)

  // Redirect to login after successful password reset
  useEffect(() => {
    if (state?.ok) {
      const timer = setTimeout(() => {
        router.push("/auth/login")
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [state, router])

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Ustaw nowe hasło</CardTitle>
        <CardDescription>Wprowadź nowe hasło dla swojego konta</CardDescription>
      </CardHeader>
      <CardContent>
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
              Za chwilę zostaniesz przekierowany do strony logowania...
            </p>
            <div className="text-center">
              <Link href="/auth/login" className="text-primary hover:underline">
                Przejdź do logowania
              </Link>
            </div>
          </div>
        ) : (
          <form action={formAction} className="space-y-4">
            {state?.error && (
              <div className="bg-destructive/10 border border-destructive/50 text-destructive px-4 py-3 rounded">
                {state.error}
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-medium">
                Nowe hasło
              </label>
              <Input 
                id="password" 
                name="password" 
                type="password" 
                placeholder="Minimum 8 znaków"
                required 
              />
              <p className="text-xs text-muted-foreground">
                Hasło musi mieć co najmniej 8 znaków
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="block text-sm font-medium">
                Potwierdź nowe hasło
              </label>
              <Input 
                id="confirmPassword" 
                name="confirmPassword" 
                type="password" 
                placeholder="Powtórz hasło"
                required 
              />
            </div>

            <SubmitButton />

            <div className="text-center text-sm text-muted-foreground">
              <Link href="/auth/login" className="text-primary hover:underline">
                Wróć do logowania
              </Link>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
