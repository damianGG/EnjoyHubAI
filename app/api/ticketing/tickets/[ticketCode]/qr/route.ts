import QRCode from "qrcode"
import { z } from "zod"

import { getPublicTicket } from "@/lib/ticketing/queries"

export const runtime = "nodejs"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ ticketCode: string }> },
) {
  const { ticketCode } = await params
  if (!z.string().uuid().safeParse(ticketCode).success) {
    return new Response("Not found", { status: 404 })
  }

  const ticket = await getPublicTicket(ticketCode)
  if (!ticket) {
    return new Response("Not found", { status: 404 })
  }

  const verificationUrl = new URL(`/bilet/${ticketCode}`, request.url).toString()
  const svg = await QRCode.toString(verificationUrl, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    width: 320,
    color: {
      dark: "#111827",
      light: "#ffffff",
    },
  })

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "private, max-age=3600",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
