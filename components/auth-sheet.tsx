"use client"

import { useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import UnifiedAuthForm from "@/components/unified-auth-form"
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

  const handleSwitchToLogin = () => {
    setCurrentMode("login")
    if (onModeChange) {
      onModeChange("login")
    }
  }

  // Sync internal mode with external mode prop (only for login/signup)
  if ((mode === "login" || mode === "signup") && currentMode !== mode && currentMode !== "forgot-password") {
    setCurrentMode(mode)
  }

  const getTitle = () => {
    switch (currentMode) {
      case "login":
      case "signup":
        return "Zaloguj się lub zarejestruj"
      case "forgot-password":
        return "Zresetuj hasło"
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto p-0">
        <SheetHeader className="p-6 pb-0 border-b">
          <SheetTitle className="text-base font-normal">{getTitle()}</SheetTitle>
        </SheetHeader>
        <div className="p-6">
          {(currentMode === "login" || currentMode === "signup") && (
            <UnifiedAuthForm 
              inline 
              onSuccess={handleSuccess} 
              mode={currentMode}
            />
          )}
          {currentMode === "forgot-password" && (
            <ForgotPasswordForm inline onSwitchToLogin={handleSwitchToLogin} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
