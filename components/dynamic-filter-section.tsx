"use client"

import { useMemo } from "react"
import { Loader2 } from "lucide-react"

import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export type DynamicFilterCondition = {
  eq?: string | boolean | number
  min?: number
  max?: number
}

export type DynamicFilterDefinition = {
  scope: "supply" | "product"
  key: string
  label: string
  valueType: "text" | "number" | "boolean" | "select" | "textarea"
  options: string[]
  unit: string | null
  sortOrder: number
}

interface DynamicFilterSectionProps {
  categoryName?: string | null
  definitions?: DynamicFilterDefinition[]
  loading?: boolean
  values: Record<string, DynamicFilterCondition>
  onValuesChange: (values: Record<string, DynamicFilterCondition>) => void
  className?: string
}

export function dynamicFilterId(definition: Pick<DynamicFilterDefinition, "scope" | "key">) {
  return `${definition.scope}:${definition.key}`
}

export function hasDynamicFilterCondition(condition?: DynamicFilterCondition) {
  return condition?.eq !== undefined || condition?.min !== undefined || condition?.max !== undefined
}

function optionLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function DynamicFilterSection({
  categoryName,
  definitions = [],
  loading = false,
  values,
  onValuesChange,
  className = "",
}: DynamicFilterSectionProps) {
  const supplyDefinitions = useMemo(
    () => definitions.filter((definition) => definition.scope === "supply"),
    [definitions],
  )
  const productDefinitions = useMemo(
    () => definitions.filter((definition) => definition.scope === "product"),
    [definitions],
  )

  if (!categoryName) return null

  const updateCondition = (definition: DynamicFilterDefinition, condition?: DynamicFilterCondition) => {
    const id = dynamicFilterId(definition)
    const next = { ...values }
    if (!condition || !hasDynamicFilterCondition(condition)) delete next[id]
    else next[id] = condition
    onValuesChange(next)
  }

  const renderControl = (definition: DynamicFilterDefinition) => {
    const id = dynamicFilterId(definition)
    const condition = values[id]

    if (definition.valueType === "boolean") {
      return (
        <label key={id} className="flex min-w-0 cursor-pointer items-start gap-3 rounded-xl border border-[#0b1220]/[0.07] bg-white p-3 text-sm hover:bg-muted/50">
          <Checkbox
            className="mt-0.5 shrink-0"
            checked={condition?.eq === true}
            onCheckedChange={(checked) => updateCondition(definition, checked === true ? { eq: true } : undefined)}
          />
          <span className="min-w-0 break-words font-medium leading-5">{definition.label}</span>
        </label>
      )
    }

    if (definition.valueType === "select") {
      const value = typeof condition?.eq === "string" ? condition.eq : "__any__"
      return (
        <div key={id} className="min-w-0 space-y-2 rounded-xl border border-[#0b1220]/[0.07] bg-white p-3">
          <Label className="block break-words leading-5">{definition.label}</Label>
          <Select
            value={value}
            onValueChange={(nextValue) => updateCondition(
              definition,
              nextValue === "__any__" ? undefined : { eq: nextValue },
            )}
          >
            <SelectTrigger className="h-10 w-full min-w-0 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__any__">Dowolne</SelectItem>
              {definition.options.map((option) => (
                <SelectItem key={option} value={option}>{optionLabel(option)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )
    }

    if (definition.valueType === "number") {
      return (
        <div key={id} className="min-w-0 space-y-2 rounded-xl border border-[#0b1220]/[0.07] bg-white p-3">
          <Label className="block break-words leading-5">{definition.label}{definition.unit ? ` (${definition.unit})` : ""}</Label>
          <div className="grid min-w-0 grid-cols-2 gap-2">
            <Input
              type="number"
              value={condition?.min ?? ""}
              onChange={(event) => {
                const min = event.target.value === "" ? undefined : Number(event.target.value)
                updateCondition(definition, {
                  ...condition,
                  min: Number.isFinite(min) ? min : undefined,
                })
              }}
              placeholder="Od"
              className="h-10 min-w-0 rounded-xl"
            />
            <Input
              type="number"
              value={condition?.max ?? ""}
              onChange={(event) => {
                const max = event.target.value === "" ? undefined : Number(event.target.value)
                updateCondition(definition, {
                  ...condition,
                  max: Number.isFinite(max) ? max : undefined,
                })
              }}
              placeholder="Do"
              className="h-10 min-w-0 rounded-xl"
            />
          </div>
        </div>
      )
    }

    return (
      <div key={id} className="min-w-0 space-y-2 rounded-xl border border-[#0b1220]/[0.07] bg-white p-3">
        <Label>{definition.label}</Label>
        <Input
          value={typeof condition?.eq === "string" ? condition.eq : ""}
          onChange={(event) => updateCondition(
            definition,
            event.target.value.trim() ? { eq: event.target.value } : undefined,
          )}
          className="h-10 min-w-0 rounded-xl"
        />
      </div>
    )
  }

  return (
    <section className={`min-w-0 space-y-4 overflow-hidden rounded-2xl border border-primary/15 bg-secondary/35 p-3.5 sm:p-4 ${className}`}>
      <div>
        <Label className="text-base">Filtry dla: {categoryName}</Label>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Te opcje zmieniają się automatycznie zależnie od wybranej aktywności.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" /> Ładuję filtry aktywności…
        </div>
      ) : definitions.length === 0 ? (
        <p className="text-sm text-muted-foreground">Ta aktywność nie ma jeszcze dodatkowych filtrów.</p>
      ) : (
        <div className="space-y-5">
          {supplyDefinitions.length > 0 && (
            <div className="space-y-3">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-primary">Obiekt</p>
                <p className="text-xs text-muted-foreground">Cechy miejsca niezależne od konkretnego pakietu.</p>
              </div>
              <div className="grid min-w-0 gap-2 sm:grid-cols-2">{supplyDefinitions.map(renderControl)}</div>
            </div>
          )}

          {productDefinitions.length > 0 && (
            <div className="space-y-3 border-t border-primary/10 pt-4">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-primary">Pakiet / oferta</p>
                <p className="text-xs text-muted-foreground">Parametry konkretnej oferty dostępnej do zakupu.</p>
              </div>
              <div className="grid min-w-0 gap-2 sm:grid-cols-2">{productDefinitions.map(renderControl)}</div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
