"use client"

import { useMemo, useState } from "react"
import { Check, Clipboard, ExternalLink, MonitorSmartphone } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface BookingWidgetInstallCardProps {
  propertyId: string
  attractionName: string
  siteUrl: string
}

export function BookingWidgetInstallCard({
  propertyId,
  attractionName,
  siteUrl,
}: BookingWidgetInstallCardProps) {
  const [copied, setCopied] = useState(false)
  const widgetUrl = `${siteUrl}/widget/rezerwacja/${propertyId}`
  const embedCode = useMemo(() => (
    `<iframe\n  src="${widgetUrl}"\n  title="Rezerwacja ${escapeAttribute(attractionName)}"\n  width="100%"\n  height="780"\n  loading="lazy"\n  style="border:0;border-radius:20px;max-width:460px;width:100%;"\n  allow="payment"\n></iframe>`
  ), [attractionName, widgetUrl])

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(embedCode)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <Card className="overflow-hidden border-[#ff5a1f]/20">
      <CardHeader className="bg-[#fff7f2]">
        <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-[#ff5a1f]/10 text-[#ff5a1f]">
          <MonitorSmartphone className="h-5 w-5" />
        </div>
        <CardTitle className="text-lg">Widget rezerwacji: {attractionName}</CardTitle>
        <CardDescription>
          Wklej ten kod na swojej stronie. Terminy, ceny i wolne miejsca będą automatycznie pobierane z EnjoyHub.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 p-5">
        <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-[#0b1220] p-4 text-xs leading-5 text-white">
          <code>{embedCode}</code>
        </pre>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" onClick={copyCode} className="flex-1 bg-[#ff5a1f] text-white hover:bg-[#e94f18]">
            {copied ? <Check className="mr-2 h-4 w-4" /> : <Clipboard className="mr-2 h-4 w-4" />}
            {copied ? "Skopiowano" : "Skopiuj kod widgetu"}
          </Button>
          <Button asChild type="button" variant="outline">
            <a href={widgetUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" /> Podgląd
            </a>
          </Button>
        </div>

        <p className="text-xs leading-5 text-muted-foreground">
          Checkout i płatność otwierają się w osobnej karcie. Dzięki temu klient nie przechodzi płatności wewnątrz małego iframe na Twojej stronie.
        </p>
      </CardContent>
    </Card>
  )
}

function escapeAttribute(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
}
