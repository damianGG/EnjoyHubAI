"use client"

import { useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import LoginForm from "@/components/login-form"
import SignUpForm from "@/components/sign-up-form"
import { useRouter } from "next/navigation"

interface AuthSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "login" | "signup"
  onModeChange?: (mode: "login" | "signup") => void
}

export function AuthSheet({ open, onOpenChange, mode, onModeChange }: AuthSheetProps) {
  const router = useRouter()
  const [currentMode, setCurrentMode] = useState(mode)

  const handleSuccess = () => {
    onOpenChange(false)
    router.refresh()
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

  // Sync internal mode with external mode prop
  if (currentMode !== mode) {
    setCurrentMode(mode)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto p-0">
        <SheetHeader className="p-6 pb-0">
          <SheetTitle>{currentMode === "login" ? "Zaloguj się" : "Zarejestruj się"}</SheetTitle>
        </SheetHeader>
        <div className="p-6">
          {currentMode === "login" ? (
            <LoginForm inline onSuccess={handleSuccess} onSwitchToSignUp={handleSwitchToSignUp} />
          ) : (
            <SignUpForm inline onSuccess={handleSuccess} onSwitchToLogin={handleSwitchToLogin} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
