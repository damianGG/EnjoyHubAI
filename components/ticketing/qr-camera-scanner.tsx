"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Camera, CameraOff, Loader2, ScanLine } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

type DetectedBarcode = { rawValue?: string }
type BarcodeDetectorInstance = { detect(source: HTMLVideoElement): Promise<DetectedBarcode[]> }
type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorInstance

function extractTicketCode(rawValue: string) {
  const value = rawValue.trim()
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  if (uuid.test(value)) return value

  try {
    const url = new URL(value, window.location.origin)
    const match = url.pathname.match(/^\/bilet\/([^/]+)\/?$/i)
    if (match?.[1] && uuid.test(match[1])) return match[1]
  } catch {
    return null
  }

  return null
}

export function QrCameraScanner() {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<number | null>(null)
  const scanningRef = useRef(false)
  const [state, setState] = useState<"idle" | "starting" | "scanning" | "unsupported" | "error">("idle")
  const [message, setMessage] = useState("")

  const stopCamera = useCallback(() => {
    scanningRef.current = false
    if (timerRef.current !== null) window.clearInterval(timerRef.current)
    timerRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  useEffect(() => stopCamera, [stopCamera])

  const startCamera = useCallback(async () => {
    stopCamera()
    setMessage("")

    const detectorCtor = (window as Window & { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector
    if (!detectorCtor || !navigator.mediaDevices?.getUserMedia) {
      setState("unsupported")
      setMessage("Ta przeglądarka nie obsługuje skanowania QR bezpośrednio w panelu. Użyj zwykłego aparatu telefonu albo wpisz kod ręcznie poniżej.")
      return
    }

    setState("starting")
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      })
      streamRef.current = stream

      const video = videoRef.current
      if (!video) throw new Error("Brak podglądu aparatu")
      video.srcObject = stream
      await video.play()

      const detector = new detectorCtor({ formats: ["qr_code"] })
      scanningRef.current = true
      setState("scanning")

      timerRef.current = window.setInterval(async () => {
        if (!scanningRef.current || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return
        try {
          const detected = await detector.detect(video)
          const ticketCode = detected
            .map((item) => item.rawValue || "")
            .map(extractTicketCode)
            .find((value): value is string => Boolean(value))

          if (!ticketCode) return
          scanningRef.current = false
          stopCamera()
          router.push(`/bilet/${ticketCode}?zrodlo=skaner`)
        } catch {
          // A failed frame should not stop the scanner. The next frame may decode normally.
        }
      }, 350)
    } catch (error) {
      stopCamera()
      setState("error")
      setMessage(error instanceof DOMException && error.name === "NotAllowedError"
        ? "Nie udzielono dostępu do aparatu. Włącz uprawnienie do kamery albo skorzystaj z trybu ręcznego."
        : "Nie udało się uruchomić aparatu. Spróbuj ponownie albo użyj aparatu systemowego telefonu.")
    }
  }, [router, stopCamera])

  return (
    <div className="space-y-4">
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border bg-black">
        <video
          ref={videoRef}
          className={`h-full w-full object-cover ${state === "scanning" ? "block" : "hidden"}`}
          playsInline
          muted
        />
        {state !== "scanning" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center text-white/80">
            {state === "starting" ? <Loader2 className="h-9 w-9 animate-spin" /> : <ScanLine className="h-10 w-10" />}
            <p className="max-w-sm text-sm">
              {state === "starting" ? "Uruchamiam aparat…" : "Skanuj kod QR biletu bez opuszczania panelu."}
            </p>
          </div>
        )}
        {state === "scanning" && (
          <div className="pointer-events-none absolute inset-[14%] rounded-2xl border-2 border-white/90 shadow-[0_0_0_999px_rgba(0,0,0,0.25)]" />
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {state === "scanning" ? (
          <Button type="button" variant="outline" onClick={() => { stopCamera(); setState("idle") }}>
            <CameraOff className="h-4 w-4" /> Zatrzymaj aparat
          </Button>
        ) : (
          <Button type="button" onClick={startCamera} disabled={state === "starting"}>
            <Camera className="h-4 w-4" /> {state === "starting" ? "Uruchamiam…" : "Uruchom skaner QR"}
          </Button>
        )}
      </div>

      {message && (
        <Alert>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
