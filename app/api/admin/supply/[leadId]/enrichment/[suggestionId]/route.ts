import { NextResponse } from "next/server"

import { getPlatformStaff } from "@/lib/platform-admin/access"

const allowedRoles = new Set(["platform_superadmin", "platform_support", "platform_content"])

export async function POST(
  request: Request,
  { params }: { params: Promise<{ leadId: string; suggestionId: string }> },
) {
  const staff = await getPlatformStaff()
  if (!staff?.user || !allowedRoles.has(staff.role)) {
    return NextResponse.json({ error: "Brak dostępu" }, { status: 403 })
  }

  const { suggestionId } = await params
  const body = await request.json().catch(() => ({}))
  const decision = body?.decision
  if (decision !== "accepted" && decision !== "rejected") {
    return NextResponse.json({ error: "Nieprawidłowa decyzja" }, { status: 400 })
  }

  const { error } = await staff.supabase.rpc("platform_supply_resolve_enrichment_suggestion", {
    p_suggestion_id: suggestionId,
    p_decision: decision,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
