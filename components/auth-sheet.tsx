"use client"

import { useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import LoginForm from "@/components/login-form"
import SignUpForm from "@/components/sign-up-form"
import ForgotPasswordForm from "@/components/forgot-password-form"
import { useRouter } from "next/navigation"

interface AuthSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "login" | "signup"
  onModeChange?: (mode: "login" | "signup") => void
  returnToPath?: string | null
}

// Internal mode type that extends the public mode with forgot-password
type InternalMode = "login" | "signup" | "forgot-password"

export function AuthSheet({ open, onOpenChange, mode, onModeChange, returnToPath }: AuthSheetProps) {
  const router = useRouter()
  // Internal mode can be forgot-password, but external API only supports login/signup
  const [currentMode, setCurrentMode] = useState<InternalMode>(mode)

  const handleSuccess = () => {
    onOpenChange(false)
    // Navigate to the return path if provided, otherwise to dashboard
    const destination = returnToPath || "/dashboard"
    router.push(destination)
  }

  const handleSwitchToSignUp = () => {
    setCurrentMode("signup")
    if (onModeChange) {
      onModeChange("signup")
    }
  }

  const handleSwitchToLogin = () => {
    setCurrentMode("login")
    if (onModeChange) {
      onModeChange("login")
    }
  }

  const handleSwitchToForgotPassword = () => {
    setCurrentMode("forgot-password")
  }

  // Sync internal mode with external mode prop (only for login/signup)
  if ((mode === "login" || mode === "signup") && currentMode !== mode && currentMode !== "forgot-password") {
    setCurrentMode(mode)
  }

  const getTitle = () => {
    switch (currentMode) {
      case "login":
        return "Zaloguj się"
      case "signup":
        return "Zarejestruj się"
      case "forgot-password":
        return "Zresetuj hasło"
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto p-0">
        <SheetHeader className="p-6 pb-0">
          <SheetTitle>{getTitle()}</SheetTitle>
        </SheetHeader>
        <div className="p-6">
          {currentMode === "login" && (
            <LoginForm 
              inline 
              onSuccess={handleSuccess} 
              onSwitchToSignUp={handleSwitchToSignUp}
              onSwitchToForgotPassword={handleSwitchToForgotPassword}
            />
          )}
          {currentMode === "signup" && (
            <SignUpForm inline onSuccess={handleSuccess} onSwitchToLogin={handleSwitchToLogin} />
          )}
          {currentMode === "forgot-password" && (
            <ForgotPasswordForm inline onSwitchToLogin={handleSwitchToLogin} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
