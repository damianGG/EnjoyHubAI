"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Baby, CalendarDays, Clock3, Sparkles, Tags, X } from "lucide-react"

import { cn } from "@/lib/utils"

function localIsoDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function currentWeekendRange(today: Date) {
  const weekday = today.getDay()

  if (weekday === 0) {
    const iso = localIsoDate(today)
    return { start: iso, end: iso }
  }

  const daysUntilSaturday = weekday === 6 ? 0 : 6 - weekday
  const saturday = addDays(today, daysUntilSaturday)
  const sunday = addDays(saturday, 1)
  return { start: localIsoDate(saturday), end: localIsoDate(sunday) }
}

type QuickFilter = {
  id: string
  label: string
  icon: typeof Sparkles
  active: boolean
  apply: (params: URLSearchParams) => void
}

export function QuickDiscoveryFilters({ className }: { className?: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const today = new Date()
  const todayIso = localIsoDate(today)
  const tomorrowIso = localIsoDate(addDays(today, 1))
  const weekend = currentWeekendRange(today)

  const selectedDate = searchParams.get("date") || ""
  const selectedDateFrom = searchParams.get("date_from") || ""
  const selectedDateTo = searchParams.get("date_to") || ""
  const selectedWhen = searchParams.get("when") || ""
  const selectedMaxPrice = searchParams.get("max_price") || ""
  const kidsActive = searchParams.get("age_min") === "0" && searchParams.get("age_max") === "12"

  const clearTime = (params: URLSearchParams) => {
    params.delete("date")
    params.delete("date_from")
    params.delete("date_to")
    params.delete("when")
  }

  const filters: QuickFilter[] = [
    {
      id: "today",
      label: "Dzisiaj",
      icon: CalendarDays,
      active: selectedDate === todayIso && selectedWhen !== "now",
      apply: (params) => {
        clearTime(params)
        params.set("date", todayIso)
      },
    },
    {
      id: "now",
      label: "Teraz",
      icon: Clock3,
      active: selectedWhen === "now",
      apply: (params) => {
        clearTime(params)
        params.set("date", todayIso)
        params.set("when", "now")
      },
    },
    {
      id: "tomorrow",
      label: "Jutro",
      icon: CalendarDays,
      active: selectedDate === tomorrowIso,
      apply: (params) => {
        clearTime(params)
        params.set("date", tomorrowIso)
      },
    },
    {
      id: "weekend",
      label: "Weekend",
      icon: Sparkles,
      active: selectedDateFrom === weekend.start && selectedDateTo === weekend.end,
      apply: (params) => {
        clearTime(params)
        params.set("date_from", weekend.start)
        params.set("date_to", weekend.end)
      },
    },
    {
      id: "kids",
      label: "Dla dzieci",
      icon: Baby,
      active: kidsActive,
      apply: (params) => {
        if (kidsActive) {
          params.delete("age_min")
          params.delete("age_max")
        } else {
          params.set("age_min", "0")
          params.set("age_max", "12")
        }
      },
    },
    {
      id: "under50",
      label: "Do 50 zł",
      icon: Tags,
      active: selectedMaxPrice === "50",
      apply: (params) => {
        if (selectedMaxPrice === "50") params.delete("max_price")
        else params.set("max_price", "50")
      },
    },
    {
      id: "under100",
      label: "Do 100 zł",
      icon: Tags,
      active: selectedMaxPrice === "100",
      apply: (params) => {
        if (selectedMaxPrice === "100") params.delete("max_price")
        else params.set("max_price", "100")
      },
    },
  ]

  const hasQuickFilters = Boolean(
    selectedDate || selectedDateFrom || selectedDateTo || selectedWhen || selectedMaxPrice || kidsActive,
  )

  const navigate = (mutate: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(searchParams.toString())
    mutate(params)
    params.delete("page")
    const query = params.toString()
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  return (
    <div className={cn("relative z-[650] border-b border-[#0b1220]/[0.05] bg-white/95 backdrop-blur", className)}>
      <div className="mx-auto flex max-w-[1600px] items-center gap-2 overflow-x-auto px-3 py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:px-6">
        <span className="hidden shrink-0 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground lg:inline">Kiedy?</span>
        {filters.map((filter) => {
          const Icon = filter.icon
          return (
            <button
              key={filter.id}
              type="button"
              onClick={() => navigate(filter.apply)}
              className={cn(
                "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold transition",
                filter.active
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-[#0b1220]/[0.08] bg-white text-foreground hover:border-primary/30 hover:bg-secondary/60",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {filter.label}
            </button>
          )
        })}

        {hasQuickFilters && (
          <button
            type="button"
            onClick={() => navigate((params) => {
              clearTime(params)
              params.delete("age_min")
              params.delete("age_max")
              params.delete("max_price")
            })}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" /> Wyczyść
          </button>
        )}
      </div>
    </div>
  )
}
