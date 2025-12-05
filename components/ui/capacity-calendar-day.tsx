"use client"

import * as React from "react"
import { DayButton } from "react-day-picker"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface CapacityDayButtonProps extends React.ComponentProps<typeof DayButton> {
  occupancyRate?: number // 0-100 percentage
  capacity?: number
  booked?: number
  showCapacityIndicator?: boolean
}

/**
 * Custom calendar day button that shows capacity/occupancy with a gradient fill
 * Fills from bottom to top with green (low) to red (high) based on occupancy
 */
export function CapacityDayButton({
  className,
  day,
  modifiers,
  occupancyRate = 0,
  capacity,
  booked,
  showCapacityIndicator = true,
  ...props
}: CapacityDayButtonProps) {
  const ref = React.useRef<HTMLButtonElement>(null)
  
  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus()
  }, [modifiers.focused])

  // Calculate gradient color based on occupancy
  const getOccupancyColor = (rate: number) => {
    if (rate >= 90) return "rgb(239, 68, 68)" // red-500
    if (rate >= 75) return "rgb(249, 115, 22)" // orange-500
    if (rate >= 50) return "rgb(251, 191, 36)" // amber-400
    if (rate >= 25) return "rgb(132, 204, 22)" // lime-500
    return "rgb(34, 197, 94)" // green-500
  }

  const occupancyColor = getOccupancyColor(occupancyRate)
  const fillHeight = `${occupancyRate}%`

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      data-day={day.date.toLocaleDateString()}
      data-selected-single={
        modifiers.selected &&
        !modifiers.range_start &&
        !modifiers.range_end &&
        !modifiers.range_middle
      }
      data-range-start={modifiers.range_start}
      data-range-end={modifiers.range_end}
      data-range-middle={modifiers.range_middle}
      className={cn(
        "relative overflow-hidden",
        "data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground",
        "data-[range-middle=true]:bg-accent data-[range-middle=true]:text-accent-foreground",
        "data-[range-start=true]:bg-primary data-[range-start=true]:text-primary-foreground",
        "data-[range-end=true]:bg-primary data-[range-end=true]:text-primary-foreground",
        "group-data-[focused=true]/day:border-ring group-data-[focused=true]/day:ring-ring/50",
        "dark:hover:text-accent-foreground",
        "flex aspect-square size-auto w-full min-w-(--cell-size) flex-col gap-1 leading-none font-normal",
        "group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:ring-[3px]",
        "data-[range-end=true]:rounded-md data-[range-end=true]:rounded-r-md",
        "data-[range-middle=true]:rounded-none",
        "data-[range-start=true]:rounded-md data-[range-start=true]:rounded-l-md",
        "[&>span]:text-xs [&>span]:opacity-70",
        className,
      )}
      {...props}
    >
      {/* Capacity fill gradient - fills from bottom to top */}
      {showCapacityIndicator && capacity !== undefined && booked !== undefined && !modifiers.disabled && (
        <div
          className="absolute inset-0 bottom-0 pointer-events-none transition-all duration-300"
          style={{
            height: fillHeight,
            background: `linear-gradient(to top, ${occupancyColor}, ${occupancyColor}40)`,
            opacity: 0.3,
          }}
        />
      )}
      
      {/* Day number - rendered on top of the gradient */}
      <span className="relative z-10">{day.date.getDate()}</span>
      
      {/* Optional capacity indicator text */}
      {showCapacityIndicator && capacity !== undefined && booked !== undefined && !modifiers.disabled && (
        <span className="relative z-10 text-[10px] font-semibold opacity-70">
          {booked}/{capacity}
        </span>
      )}
    </Button>
  )
}
