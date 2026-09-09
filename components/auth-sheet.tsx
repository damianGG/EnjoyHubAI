"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { BrandLogo } from "@/components/brand-logo"
import LoginForm from "@/components/login-form"
import ForgotPasswordForm from "@/components/forgot-password-form"
import SignUpForm from "@/components/sign-up-form"
import { getSafeAuthReturnTo } from "@/lib/auth/return-to"

interface AuthSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "login" | "signup"
  onModeChange?: (mode: "login" | "signup") => void
  returnToPath?: string | null
}

type InternalMode = "login" | "signup" | "forgot-password"

export function AuthSheet({ open, onOpenChange, mode, onModeChange, returnToPath }: AuthSheetProps) {
  const router = useRouter()
  const destination = getSafeAuthReturnTo(returnToPath)
  const [currentMode, setCurrentMode] = useState<InternalMode>(mode)

  const handleSuccess = () => {
    onOpenChange(false)
    router.push(destination)
    router.refresh()
  }

  const handleSwitchToLogin = () => {
    setCurrentMode("login")
    onModeChange?.("login")
  }

  const handleSwitchToSignUp = () => {
    setCurrentMode("signup")
    onModeChange?.("signup")
  }

  const handleSwitchToForgotPassword = () => setCurrentMode("forgot-password")

  useEffect(() => {
    setCurrentMode(mode)
  }, [mode, open])

  const title = currentMode === "forgot-password"
    ? "Zresetuj hasło"
    : currentMode === "signup"
      ? "Utwórz konto"
      : "Zaloguj się"

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="h-[100dvh] w-full max-w-none overflow-y-auto border-0 bg-white p-0 sm:max-w-md sm:border-l sm:border-[#0b1220]/[0.07]"
      >
        <SheetHeader className="sticky top-0 z-10 border-b border-[#0b1220]/[0.055] bg-white/95 px-5 pb-4 pt-[max(14px,env(safe-area-inset-top))] text-left backdrop-blur-xl sm:p-6 sm:pb-4">
          <div className="mb-2 sm:hidden"><BrandLogo mobile href={undefined} /></div>
          <SheetTitle className="text-xl font-extrabold tracking-[-0.035em] sm:text-lg">{title}</SheetTitle>
          <p className="pr-8 text-xs leading-5 text-muted-foreground sm:text-sm">
            {currentMode === "forgot-password"
              ? "Podaj adres e-mail, a wyślemy Ci instrukcję resetowania hasła."
              : "Twoje rezerwacje, bilety i ulubione miejsca będą zawsze pod ręką."}
          </p>
        </SheetHeader>

        <div className="mx-auto w-full max-w-md px-5 py-6 sm:px-6">
          {currentMode === "login" && (
            <LoginForm
              inline
              returnToPath={destination}
              onSuccess={handleSuccess}
              onSwitchToSignUp={handleSwitchToSignUp}
              onSwitchToForgotPassword={handleSwitchToForgotPassword}
            />
          )}
          {currentMode === "signup" && (
            <SignUpForm
              inline
              returnToPath={destination}
              onSuccess={handleSuccess}
              onSwitchToLogin={handleSwitchToLogin}
            />
          )}
          {currentMode === "forgot-password" && (
            <ForgotPasswordForm
              inline
              returnToPath={destination}
              onSwitchToLogin={handleSwitchToLogin}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}