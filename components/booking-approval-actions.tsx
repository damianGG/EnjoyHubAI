"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { CheckCircle, XCircle, Loader2, Mail, Phone } from "lucide-react"
import { useRouter } from "next/navigation"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface BookingApprovalActionsProps {
  bookingId: string
}

export function BookingApprovalActions({ bookingId }: BookingApprovalActionsProps) {
  const router = useRouter()
  const [isApproving, setIsApproving] = useState(false)
  const [isRejecting, setIsRejecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ message: string; notifications?: any } | null>(null)

  const handleApprove = async () => {
    setIsApproving(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch(`/api/bookings/${bookingId}/approve`, {
        method: "POST",
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to approve booking")
      }

      setSuccess({
        message: "Rezerwacja została zatwierdzona!",
        notifications: data.notifications,
      })

      // Refresh the page to show updated booking status
      setTimeout(() => {
        router.refresh()
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsApproving(false)
    }
  }

  const handleReject = async () => {
    setIsRejecting(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch(`/api/bookings/${bookingId}/reject`, {
        method: "POST",
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to reject booking")
      }

      setSuccess({
        message: "Rezerwacja została odrzucona",
        notifications: data.notifications,
      })

      // Refresh the page to show updated booking status
      setTimeout(() => {
        router.refresh()
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsRejecting(false)
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <div>{success.message}</div>
              {success.notifications && (
                <div className="text-sm flex items-center gap-4">
                  {success.notifications.email && (
                    <span className="flex items-center gap-1 text-green-600">
                      <Mail className="h-3 w-3" />
                      Email wysłany
                    </span>
                  )}
                  {success.notifications.sms && (
                    <span className="flex items-center gap-1 text-green-600">
                      <Phone className="h-3 w-3" />
                      SMS wysłany
                    </span>
                  )}
                  {!success.notifications.phoneProvided && (
                    <span className="flex items-center gap-1 text-orange-600">
                      <Phone className="h-3 w-3" />
                      Brak telefonu - tylko email
                    </span>
                  )}
                </div>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex gap-2">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="default"
              disabled={isApproving || isRejecting || !!success}
              className="flex-1"
            >
              {isApproving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Zatwierdzanie...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Zatwierdź Rezerwację
                </>
              )}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Zatwierdź rezerwację</AlertDialogTitle>
              <AlertDialogDescription>
                Czy na pewno chcesz zatwierdzić tę rezerwację? Klient otrzyma powiadomienie email oraz SMS (jeśli podał numer telefonu).
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Anuluj</AlertDialogCancel>
              <AlertDialogAction onClick={handleApprove}>
                Zatwierdź
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="destructive"
              disabled={isApproving || isRejecting || !!success}
              className="flex-1"
            >
              {isRejecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Odrzucanie...
                </>
              ) : (
                <>
                  <XCircle className="mr-2 h-4 w-4" />
                  Odrzuć Rezerwację
                </>
              )}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Odrzuć rezerwację</AlertDialogTitle>
              <AlertDialogDescription>
                Czy na pewno chcesz odrzucić tę rezerwację? Klient zostanie powiadomiony emailem.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Anuluj</AlertDialogCancel>
              <AlertDialogAction onClick={handleReject} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Odrzuć
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}
