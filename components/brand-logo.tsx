import Link from "next/link"
import { cn } from "@/lib/utils"

interface BrandLogoProps {
  href?: string
  compact?: boolean
  mobile?: boolean
  className?: string
}

function SmileMark({ small = false }: { small?: boolean }) {
  return (
    <span
      className={cn(
        "relative grid shrink-0 place-items-center bg-primary shadow-[0_7px_18px_rgba(244,117,33,0.22)]",
        small ? "h-7 w-7 rounded-[10px]" : "h-10 w-10 rounded-[14px]"
      )}
    >
      <svg viewBox="0 0 40 40" className={small ? "h-[22px] w-[22px]" : "h-8 w-8"} aria-hidden="true">
        <circle cx="13.5" cy="15" r="2.2" fill="white" />
        <circle cx="26.5" cy="15" r="2.2" fill="white" />
        <path
          d="M10.8 22.2c2.3 4.2 5.5 6.3 9.4 6.3 3.8 0 6.9-2.1 9-6.3"
          fill="none"
          stroke="white"
          strokeWidth="2.8"
          strokeLinecap="round"
        />
      </svg>
    </span>
  )
}

function SignatureY() {
  return (
    <svg viewBox="0 0 18 24" className="mx-[1px] h-[20px] w-[15px] overflow-visible" aria-hidden="true">
      <path
        d="M2.2 4.2 8 11.2l5.8-7M8 11.2v2.3c0 4.6 2.6 6.6 6.1 6.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function BrandLogo({ href = "/", compact = false, mobile = false, className }: BrandLogoProps) {
  const content = (
    <span className={cn("inline-flex items-center", mobile ? "gap-1.5" : "gap-2.5", className)} aria-label="EnjoyHub">
      <SmileMark small={mobile} />
      {!compact && (
        <span
          className={cn(
            "inline-flex items-center font-bold tracking-[-0.055em] text-foreground",
            mobile ? "text-[1.05rem]" : "text-[1.45rem] md:text-[1.65rem]"
          )}
        >
          <span>enjo</span>
          <span className="inline-flex text-primary"><SignatureY /></span>
          <span>hub</span>
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
