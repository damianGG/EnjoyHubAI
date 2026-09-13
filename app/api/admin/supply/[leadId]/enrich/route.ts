import { NextResponse } from "next/server"

import { getPlatformStaff } from "@/lib/platform-admin/access"

export const runtime = "nodejs"
export const maxDuration = 60

const allowedRoles = new Set(["platform_superadmin", "platform_support", "platform_content"])
const allowedLeadFields = [
  "website_url",
  "booking_url",
  "phone",
  "email",
  "address_line_1",
  "city",
  "region",
  "postal_code",
  "country_code",
  "short_description",
  "public_description",
  "price_from",
  "booking_method",
  "has_paid_offer",
  "requires_schedule",
  "group_offer",
  "indoor",
  "year_round",
] as const

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ leadId: string }> },
) {
  const staff = await getPlatformStaff()
  if (!staff?.user || !allowedRoles.has(staff.role)) {
    return NextResponse.json({ error: "Brak dostępu" }, { status: 403 })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: "Brak OPENAI_API_KEY w środowisku Vercel. Moduł AI jest gotowy, ale klucz API nie jest skonfigurowany." },
      { status: 503 },
    )
  }

  const { leadId } = await params
  const [{ data: lead, error: leadError }, { data: enrichment, error: enrichmentError }] = await Promise.all([
    staff.supabase.rpc("platform_supply_get_lead", { p_lead_id: leadId }),
    staff.supabase.rpc("platform_supply_get_enrichment", { p_lead_id: leadId }),
  ])

  if (leadError || enrichmentError || !lead) {
    return NextResponse.json({ error: "Nie udało się pobrać danych Supply" }, { status: 404 })
  }

  const model = process.env.OPENAI_ENRICHMENT_MODEL || "gpt-5.6-luna"
  const { data: runId, error: runError } = await staff.supabase.rpc("platform_supply_start_enrichment", {
    p_lead_id: leadId,
    p_model: model,
  })

  if (runError || !runId) {
    return NextResponse.json({ error: "Nie udało się rozpocząć enrichmentu" }, { status: 500 })
  }

  try {
    const definitions = Array.isArray((enrichment as any)?.definitions) ? (enrichment as any).definitions : []
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
              "Jesteś modułem researchu danych dla marketplace EnjoyHub w Polsce.",
              "Wyszukuj wyłącznie publicznie dostępne informacje o wskazanej atrakcji i zwracaj fakty, które da się podeprzeć konkretnym URL-em.",
              "Preferuj oficjalną stronę operatora i oficjalny system rezerwacji. Serwisy z opiniami wykorzystuj wyłącznie do zagregowanej oceny i liczby opinii.",
              "Nie kopiuj treści pojedynczych opinii klientów i nie zwracaj cudzych zdjęć.",
              "Nie zgaduj. Jeżeli fakt nie ma dobrego źródła, pomiń go.",
              "Każdy fakt ma być osobną sugestią do ręcznego zatwierdzenia przez administratora.",
              `Dla target_type=lead_field wolno używać wyłącznie kluczy: ${allowedLeadFields.join(", ")}.`,
              "Dla target_type=attribute użyj istniejącego klucza atrybutu, jeśli pasuje. Możesz zaproponować nowy krótki snake_case klucz tylko wtedy, gdy informacja jest istotna dla decyzji klienta.",
              "Dla target_type=external_signal provider powinien być nazwą źródła zagregowanej oceny (np. google, tripadvisor, facebook), a rating i review_count muszą pochodzić z tego samego źródła.",
              "booking_method: unknown, none, phone, whatsapp, messenger, form, email albo own_booking.",
              "Confidence 90-100 oznacza bezpośredni jednoznaczny fakt z oficjalnego źródła; 70-89 mocne źródło pośrednie; poniżej 70 tylko gdy informacja nadal jest użyteczna do ręcznej weryfikacji.",
            ].join("\n"),
          },
          {
            role: "user",
            content: JSON.stringify({
              task: "Uzupełnij możliwie dużo przydatnych danych o tej atrakcji. Sprawdź aktualne dane w internecie.",
              lead: {
                name: (lead as any).name,
                city: (lead as any).city,
                region: (lead as any).region,
                website_url: (lead as any).website_url,
                source_url: (lead as any).source_url,
                booking_url: (lead as any).booking_url,
                category: (lead as any).categoryName,
                subcategory: (lead as any).subcategoryName,
                current_price_from: (lead as any).price_from,
                current_booking_method: (lead as any).booking_method,
              },
              category_attributes: definitions.map((item: any) => ({
                key: item.key,
                label: item.label,
                value_type: item.value_type,
                ai_prompt: item.ai_prompt,
              })),
            }),
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "enjoyhub_supply_enrichment",
            strict: true,
            schema: {
              type: "object",
              properties: {
                summary: { type: "string" },
                facts: {
                  type: "array",
                  maxItems: 50,
                  items: {
                    type: "object",
                    properties: {
                      target_type: { type: "string", enum: ["lead_field", "attribute", "external_signal"] },
                      key: { type: "string" },
                      label: { type: "string" },
                      value_type: { type: "string", enum: ["text", "number", "boolean", "select", "textarea", "rating"] },
                      value: { type: ["string", "null"] },
                      numeric_value: { type: ["number", "null"] },
                      boolean_value: { type: ["boolean", "null"] },
                      rating: { type: ["number", "null"] },
                      review_count: { type: ["integer", "null"] },
                      provider: { type: ["string", "null"] },
                      source_url: { type: "string" },
                      source_title: { type: "string" },
                      confidence: { type: "integer", minimum: 0, maximum: 100 },
                      rationale: { type: "string" },
                    },
                    required: [
                      "target_type",
                      "key",
                      "label",
                      "value_type",
                      "value",
                      "numeric_value",
                      "boolean_value",
                      "rating",
                      "review_count",
                      "provider",
                      "source_url",
                      "source_title",
                      "confidence",
                      "rationale",
                    ],
                    additionalProperties: false,
                  },
                },
              },
              required: ["summary", "facts"],
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
    if (!outputText) throw new Error("Model nie zwrócił danych strukturalnych")

    const result = JSON.parse(outputText)
    const rawMeta = {
      responseId: raw.id ?? null,
      status: raw.status ?? null,
      model: raw.model ?? model,
      usage: raw.usage ?? null,
    }

    const { data: suggestionCount, error: finishError } = await staff.supabase.rpc("platform_supply_finish_enrichment", {
      p_run_id: runId,
      p_result: result,
      p_raw_response: rawMeta,
    })

    if (finishError) throw new Error(finishError.message)

    return NextResponse.json({
      ok: true,
      runId,
      suggestionCount: Number(suggestionCount || 0),
      summary: result.summary,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nieznany błąd enrichmentu"
    await staff.supabase.rpc("platform_supply_fail_enrichment", {
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
