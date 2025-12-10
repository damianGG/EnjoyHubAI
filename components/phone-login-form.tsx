"use client"

import { useActionState, useEffect, useState } from "react"
import { useFormStatus } from "react-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Phone } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { sendPhoneOTP, verifyPhoneOTP } from "@/lib/actions"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"

interface PhoneLoginFormProps {
  inline?: boolean
  onSuccess?: () => void
  onSwitchToEmailLogin?: () => void
}

function SendOTPButton() {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Wysyłanie kodu...
        </>
      ) : (
        <>
          <Phone className="mr-2 h-4 w-4" />
          Wyślij kod SMS
        </>
      )}
    </Button>
  )
}

function VerifyOTPButton() {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Weryfikacja...
        </>
      ) : (
        "Zweryfikuj i zaloguj się"
      )}
    </Button>
  )
}

export default function PhoneLoginForm({ inline = false, onSuccess, onSwitchToEmailLogin }: PhoneLoginFormProps = {}) {
  const router = useRouter()
  const [step, setStep] = useState<"phone" | "verify">("phone")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [otp, setOtp] = useState("")
  
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
    const phone = formData.get("phone")
    if (phone) {
      setPhoneNumber(String(phone))
    }
    sendOTPAction(formData)
  }

  const handleVerifyOTP = (formData: FormData) => {
    // Add phone number to form data
    formData.set("phone", phoneNumber)
    verifyOTPAction(formData)
  }

  const content = (
    <>
      {step === "phone" ? (
        <form action={handleSendOTP} className="space-y-4">
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
              Numer telefonu
            </label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              placeholder="+48 123 456 789"
              required
            />
            <p className="text-xs text-muted-foreground">
              Wprowadź numer z kodem kraju (np. +48)
            </p>
          </div>

          <SendOTPButton />

          <div className="text-center text-sm text-muted-foreground">
            Wolisz logować się emailem?{" "}
            {onSwitchToEmailLogin ? (
              <button
                type="button"
                onClick={onSwitchToEmailLogin}
                className="text-primary hover:underline"
              >
                Użyj emaila
              </button>
            ) : (
              <Link href="/auth/login" className="text-primary hover:underline">
                Użyj emaila
              </Link>
            )}
          </div>
        </form>
      ) : (
        <form action={handleVerifyOTP} className="space-y-4">
          {verifyOTPState?.error && (
            <div className="bg-destructive/10 border border-destructive/50 text-destructive px-4 py-3 rounded">
              {verifyOTPState.error}
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-sm font-medium">
              Kod weryfikacyjny
            </label>
            <p className="text-sm text-muted-foreground mb-3">
              Wprowadź 6-cyfrowy kod wysłany na numer {phoneNumber}
            </p>
            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={otp}
                onChange={setOtp}
                name="token"
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
          </div>

          <VerifyOTPButton />

          <div className="text-center text-sm text-muted-foreground">
            Nie otrzymałeś kodu?{" "}
            <button
              type="button"
              onClick={() => {
                setStep("phone")
                setOtp("")
              }}
              className="text-primary hover:underline"
            >
              Wyślij ponownie
            </button>
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
        <CardTitle className="text-2xl">Logowanie przez SMS</CardTitle>
        <CardDescription>
          {step === "phone" 
            ? "Wprowadź swój numer telefonu, aby otrzymać kod weryfikacyjny"
            : "Wprowadź kod wysłany SMS-em"}
        </CardDescription>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  )
}
