"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Phone, Loader2, CheckCircle, AlertCircle } from "lucide-react"
import { sendBookingSMS } from "@/lib/sms/send-booking-sms"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface SendSMSCardProps {
  bookingId: string
  customerPhone: string
}

export default function SendSMSCard({ bookingId, customerPhone }: SendSMSCardProps) {
  const [isSending, setIsSending] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  const handleSendSMS = async () => {
    setIsSending(true)
    setResult(null)

    try {
      const response = await sendBookingSMS({ bookingId })
      setResult(response)
    } catch (error) {
      setResult({
        success: false,
        message: "Wystąpił błąd podczas wysyłania SMS"
      })
    } finally {
      setIsSending(false)
    }
  }

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center text-lg">
          <Phone className="h-5 w-5 mr-2" />
          Wyślij potwierdzenie SMS
        </CardTitle>
        <CardDescription>
          Otrzymaj SMS z potwierdzeniem rezerwacji na numer {customerPhone}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {result && (
          <Alert variant={result.success ? "default" : "destructive"}>
            {result.success ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertTitle>{result.success ? "Sukces" : "Błąd"}</AlertTitle>
            <AlertDescription>{result.message}</AlertDescription>
          </Alert>
        )}
        
        <Button 
          className="w-full" 
          variant="outline" 
          onClick={handleSendSMS}
          disabled={isSending || result?.success}
        >
          {isSending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Wysyłanie...
            </>
          ) : result?.success ? (
            <>
              <CheckCircle className="h-4 w-4 mr-2" />
              SMS wysłany
            </>
          ) : (
            <>
              <Phone className="h-4 w-4 mr-2" />
              Wyślij SMS z potwierdzeniem
            </>
          )}
        </Button>
        <p className="text-xs text-muted-foreground text-center">
          SMS będzie zawierać datę, godzinę i miejsce rezerwacji
        </p>
      </CardContent>
    </Card>
  )
}
