import { NextResponse } from "next/server"

import { getPlatformStaff } from "@/lib/platform-admin/access"

export const runtime = "nodejs"
export const maxDuration = 60

const allowedRoles = new Set(["platform_superadmin", "platform_support", "platform_content"])

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  const staff = await getPlatformStaff()
  if (!staff?.user || !allowedRoles.has(staff.role)) {
    return NextResponse.json({ error: "Brak dostępu" }, { status: 403 })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: "Brak OPENAI_API_KEY. Discovery jest gotowe, ale wymaga klucza API w środowisku Vercel." },
      { status: 503 },
    )
  }

  const { campaignId } = await params
  const { data: startRows, error: startError } = await staff.supabase.rpc("platform_supply_start_discovery", {
    p_campaign_id: campaignId,
  })

  const start = Array.isArray(startRows) ? startRows[0] : null
  if (startError || !start) {
    const noQueries = startError?.code === "P0002" || startError?.message?.includes("No pending discovery queries")
    return NextResponse.json(
      { error: noQueries ? "Brak kolejnych zapytań do wykonania." : "Nie udało się rozpocząć Discovery." },
      { status: noQueries ? 409 : 500 },
    )
  }

  const runId = String(start.run_id)
  const model = process.env.OPENAI_DISCOVERY_MODEL || String(start.campaign_model || "gpt-5.6-luna")

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        reasoning: { effort: "low" },
        tools: [{ type: "web_search", search_context_size: "medium" }],
        input: [
          {
            role: "system",
            content: [
              "Jesteś agentem Discovery dla marketplace atrakcji EnjoyHub w Polsce.",
              "Twoim zadaniem jest WYŁĄCZNIE znalezienie realnych operatorów lub obiektów oferujących wskazaną atrakcję. Nie rób pełnego enrichmentu.",
              "Dla kampanii Paintball szukaj miejsc, w których klient może faktycznie zagrać w paintball, także kilkadziesiąt kilometrów od miasta wpisanego w zapytaniu.",
              "Wyklucz sklepy ze sprzętem, katalogi firm, portale z kuponami, artykuły, fora, producentów sprzętu i wydarzenia jednorazowe, jeśli nie prowadzą stałego obiektu/usługi.",
              "Preferuj oficjalną stronę operatora. Jeśli jej nie ma, użyj wiarygodnej publicznej strony potwierdzającej istnienie firmy.",
              "Nie kopiuj zdjęć ani treści opinii. Nie zgaduj telefonu, adresu, strony ani lokalizacji.",
              "Nie zwracaj tej samej firmy dwa razy w jednym wyniku.",
              "source_url musi być konkretnym URL-em, który potwierdza istnienie operatora. website_url podawaj tylko jeśli znalazłeś oficjalną stronę firmy.",
              "confidence 90-100: operator i oferta są jednoznacznie potwierdzone oficjalnym źródłem; 75-89: mocne źródło pośrednie; poniżej 75 tylko jeśli kandydat nadal jest sensowny do ręcznej weryfikacji.",
              "region zwracaj jako polską nazwę województwa, jeśli da się ją wiarygodnie ustalić.",
            ].join("\n"),
          },
          {
            role: "user",
            content: JSON.stringify({
              task: "Znajdź możliwie kompletne grono realnych operatorów pasujących do tego zapytania. To etap odkrywania kandydatów, nie pełnego opisywania oferty.",
              campaign: {
                category: start.category_name,
                country: "Polska",
                target_location: start.location_name,
                search_query: start.query_text,
              },
            }),
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "enjoyhub_supply_discovery",
            strict: true,
            schema: {
              type: "object",
              properties: {
                summary: { type: "string" },
                candidates: {
                  type: "array",
                  maxItems: 20,
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      website_url: { type: ["string", "null"] },
                      phone: { type: ["string", "null"] },
                      email: { type: ["string", "null"] },
                      address_line_1: { type: ["string", "null"] },
                      city: { type: ["string", "null"] },
                      region: { type: ["string", "null"] },
                      postal_code: { type: ["string", "null"] },
                      country_code: { type: ["string", "null"] },
                      latitude: { type: ["number", "null"] },
                      longitude: { type: ["number", "null"] },
                      source_url: { type: "string" },
                      source_title: { type: ["string", "null"] },
                      source_provider: { type: "string" },
                      external_id: { type: ["string", "null"] },
                      confidence: { type: "integer", minimum: 0, maximum: 100 },
                      why_match: { type: "string" },
                    },
                    required: [
                      "name",
                      "website_url",
                      "phone",
                      "email",
                      "address_line_1",
                      "city",
                      "region",
                      "postal_code",
                      "country_code",
                      "latitude",
                      "longitude",
                      "source_url",
                      "source_title",
                      "source_provider",
                      "external_id",
                      "confidence",
                      "why_match",
                    ],
                    additionalProperties: false,
                  },
                },
              },
              required: ["summary", "candidates"],
              additionalProperties: false,
            },
          },
        },
      }),
      cache: "no-store",
    })

    const raw = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(raw?.error?.message || `OpenAI API ${response.status}`)
    }

    const outputText = extractOutputText(raw)
    if (!outputText) throw new Error("Model Discovery nie zwrócił danych strukturalnych")

    const parsed = JSON.parse(outputText)
    const candidates = Array.isArray(parsed?.candidates)
      ? parsed.candidates.filter((candidate: any) => candidate?.name && candidate?.source_url)
      : []

    const { data: result, error: finishError } = await staff.supabase.rpc("platform_supply_finish_discovery", {
      p_run_id: runId,
      p_candidates: candidates,
      p_raw_metadata: {
        responseId: raw.id ?? null,
        status: raw.status ?? null,
        model: raw.model ?? model,
        usage: raw.usage ?? null,
        summary: typeof parsed?.summary === "string" ? parsed.summary : null,
      },
    })

    if (finishError) throw new Error(finishError.message)

    return NextResponse.json({
      ok: true,
      runId,
      query: start.query_text,
      location: start.location_name,
      ...(result ?? {}),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nieznany błąd Discovery"
    await staff.supabase.rpc("platform_supply_fail_discovery", {
      p_run_id: runId,
      p_error: message,
    })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

function extractOutputText(payload: any) {
  for (const item of payload?.output ?? []) {
    if (item?.type !== "message") continue
    for (const content of item?.content ?? []) {
      if (content?.type === "output_text" && typeof content.text === "string") return content.text
    }
  }
  return null
}
