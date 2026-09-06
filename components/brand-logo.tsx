import Link from "next/link"
import { cn } from "@/lib/utils"

interface BrandLogoProps {
  href?: string
  compact?: boolean
  className?: string
}

export function BrandLogo({ href = "/", compact = false, className }: BrandLogoProps) {
  const content = (
    <span className={cn("inline-flex items-center gap-2.5", className)} aria-label="EnjoyHub">
      <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-primary shadow-[0_7px_18px_rgba(244,117,33,0.25)]">
        <svg viewBox="0 0 40 40" className="h-8 w-8" aria-hidden="true">
          <circle cx="13.5" cy="15" r="2.2" fill="white" />
          <circle cx="26.5" cy="15" r="2.2" fill="white" />
          <path
            d="M10.8 22.2c2.3 4.2 5.5 6.3 9.4 6.3 3.8 0 6.9-2.1 9-6.3"
            fill="none"
            stroke="white"
            strokeWidth="2.8"
            strokeLinecap="round"
          />
          <path
            d="M31.2 9.7l1.1 2.1 2.2.4-1.6 1.6.4 2.2-2.1-1-2 1 .4-2.2-1.6-1.6 2.2-.4 1-2.1Z"
            fill="white"
            opacity=".96"
          />
        </svg>
      </span>
      {!compact && (
        <span className="text-[1.45rem] font-bold tracking-[-0.055em] text-foreground md:text-[1.65rem]">
          enjoy<span className="text-primary">hub</span>
        </span>
      )}
    </span>
  )

  if (!href) return content

  return (
    <Link href={href} className="inline-flex items-center rounded-xl outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-primary/40">
      {content}
    </Link>
  )
}
