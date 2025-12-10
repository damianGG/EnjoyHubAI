"use client"

import { useActionState, useEffect, useState } from "react"
import { useFormStatus } from "react-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Mail } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { sendPhoneOTP, verifyPhoneOTP, signInWithGoogle, signInWithFacebook } from "@/lib/actions"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"

interface UnifiedAuthFormProps {
  inline?: boolean
  onSuccess?: () => void
  mode?: "login" | "signup"
}

function ContinueButton() {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" disabled={pending} className="w-full bg-pink-600 hover:bg-pink-700">
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Wysyłanie...
        </>
      ) : (
        "Dalej"
      )}
    </Button>
  )
}

function GoogleSignInButton() {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" variant="outline" disabled={pending} className="w-full border-2 border-gray-300 hover:border-gray-900">
      {pending ? (
        <>
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Łączenie...
        </>
      ) : (
        <>
          <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
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
          Kontynuuj, używając Google
        </>
      )}
    </Button>
  )
}

function FacebookSignInButton() {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" variant="outline" disabled={pending} className="w-full border-2 border-gray-300 hover:border-gray-900">
      {pending ? (
        <>
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Łączenie...
        </>
      ) : (
        <>
          <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24" fill="#1877F2">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
          Kontynuuj, używając Facebooka
        </>
      )}
    </Button>
  )
}

function VerifyOTPButton() {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" disabled={pending} className="w-full bg-pink-600 hover:bg-pink-700">
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Weryfikacja...
        </>
      ) : (
        "Dalej"
      )}
    </Button>
  )
}

export default function UnifiedAuthForm(props: UnifiedAuthFormProps = {}) {
  const { inline = false, onSuccess, mode = "login" } = props
  const router = useRouter()
  const [step, setStep] = useState<"initial" | "verify">("initial")
  const [countryCode, setCountryCode] = useState("+48")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [otp, setOtp] = useState("")
  const [showEmailLogin, setShowEmailLogin] = useState(false)
  
  const [sendOTPState, sendOTPAction] = useActionState(sendPhoneOTP, null)
  const [verifyOTPState, verifyOTPAction] = useActionState(verifyPhoneOTP, null)

  // Handle OTP sent successfully
  useEffect(() => {
    if (sendOTPState?.ok) {
      setStep("verify")
    }
  }, [sendOTPState])

  // Handle successful verification
  useEffect(() => {
    if (verifyOTPState?.ok) {
      if (onSuccess) {
        onSuccess()
      } else {
        router.push("/")
      }
    }
  }, [verifyOTPState, router, onSuccess])

  const handleSendOTP = (formData: FormData) => {
    const phone = `${countryCode}${formData.get("phone")}`
    setPhoneNumber(phone)
    formData.set("phone", phone)
    sendOTPAction(formData)
  }

  const handleVerifyOTP = (formData: FormData) => {
    formData.set("phone", phoneNumber)
    verifyOTPAction(formData)
  }

  const content = (
    <>
      {step === "initial" ? (
        <div className="space-y-4">
          {/* Phone Number Section */}
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold">Witaj w EnjoyHub</h2>
            
            <form action={handleSendOTP} className="space-y-3">
              {sendOTPState?.error && (
                <div className="bg-destructive/10 border border-destructive/50 text-destructive px-4 py-3 rounded">
                  {sendOTPState.error}
                </div>
              )}

              {sendOTPState?.message && !sendOTPState.error && (
                <div className="bg-green-500/10 border border-green-500/50 text-green-700 px-4 py-3 rounded">
                  {sendOTPState.message}
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="phone" className="block text-sm font-medium">
                  Kraj/region
                </label>
                <Select value={countryCode} onValueChange={setCountryCode}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Wybierz kraj" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="+48">Polska (+48)</SelectItem>
                    <SelectItem value="+1">Stany Zjednoczone (+1)</SelectItem>
                    <SelectItem value="+44">Wielka Brytania (+44)</SelectItem>
                    <SelectItem value="+49">Niemcy (+49)</SelectItem>
                    <SelectItem value="+33">Francja (+33)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label htmlFor="phone" className="block text-sm font-medium">
                  Numer telefonu
                </label>
                <div className="relative">
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    placeholder="123 456 789"
                    required
                    className="pl-3"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Zadzwonimy lub wyślemy SMS-a, aby potwierdzić Twój numer. Obowiązują standardowe opłaty za wysyłanie wiadomości i transmisję danych.{" "}
                  <Link href="/privacy" className="underline">
                    Polityka Prywatności
                  </Link>
                </p>
              </div>

              <ContinueButton />
            </form>
          </div>

          {/* Separator */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-background px-2 text-muted-foreground">lub</span>
            </div>
          </div>

          {/* OAuth Buttons */}
          <div className="space-y-3">
            <form action={signInWithGoogle}>
              <GoogleSignInButton />
            </form>

            <form action={signInWithFacebook}>
              <FacebookSignInButton />
            </form>

            <Button
              type="button"
              variant="outline"
              className="w-full border-2 border-gray-300 hover:border-gray-900"
              onClick={() => setShowEmailLogin(true)}
            >
              <Mail className="mr-2 h-5 w-5" />
              Użyj adresu e-mail
            </Button>
          </div>

          {/* Email Login Modal/Expanded Section */}
          {showEmailLogin && (
            <div className="mt-4 p-4 border rounded-lg space-y-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">Logowanie przez email</h3>
                <button
                  onClick={() => setShowEmailLogin(false)}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  ✕
                </button>
              </div>
              <div className="space-y-2">
                <label htmlFor="email" className="block text-sm font-medium">
                  Email
                </label>
                <Input id="email" name="email" type="email" placeholder="twoj@email.com" required />
              </div>
              <div className="space-y-2">
                <label htmlFor="password" className="block text-sm font-medium">
                  Hasło
                </label>
                <Input id="password" name="password" type="password" required />
              </div>
              <Button className="w-full bg-pink-600 hover:bg-pink-700">
                Zaloguj się
              </Button>
              <div className="text-center text-sm">
                <Link href="/auth/forgot-password" className="text-primary hover:underline">
                  Zapomniałeś hasła?
                </Link>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* OTP Verification Step */
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => {
                setStep("initial")
                setOtp("")
              }}
              className="text-sm hover:underline"
            >
              ← Wróć
            </button>
          </div>

          <h2 className="text-2xl font-semibold">Potwierdź swój numer</h2>
          
          <form action={handleVerifyOTP} className="space-y-4">
            {verifyOTPState?.error && (
              <div className="bg-destructive/10 border border-destructive/50 text-destructive px-4 py-3 rounded">
                {verifyOTPState.error}
              </div>
            )}

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Wprowadź 6-cyfrowy kod wysłany na numer {phoneNumber}
              </p>
              <div className="flex justify-center">
                <InputOTP
                  maxLength={6}
                  value={otp}
                  onChange={setOtp}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <input type="hidden" name="token" value={otp} />
            </div>

            <VerifyOTPButton />

            <div className="text-center text-sm">
              <button
                type="button"
                onClick={() => {
                  setStep("initial")
                  setOtp("")
                }}
                className="text-primary hover:underline"
              >
                Nie otrzymałeś kodu? Wyślij ponownie
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )

  if (inline) {
    return <div className="w-full">{content}</div>
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center border-b pb-4">
        <CardTitle className="text-base font-normal">
          {step === "initial" ? "Zaloguj się lub zarejestruj" : "Weryfikacja numeru telefonu"}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">{content}</CardContent>
    </Card>
  )
}
