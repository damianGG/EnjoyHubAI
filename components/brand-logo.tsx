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
    <svg
      viewBox="0 0 64 64"
      className={small ? "h-8 w-8 shrink-0" : "h-10 w-10 shrink-0"}
      aria-hidden="true"
    >
      <circle cx="32" cy="15" r="8.5" fill="#FF5A1F" />
      <path
        fill="#FF5A1F"
        d="M12.9 24.2c2.9-3.5 8.2-2.8 10.3 1.2 2.2 4.1 5 6.3 8.8 6.3s6.7-2.2 8.8-6.3c2.1-4 7.4-4.7 10.3-1.2 3 3.5 2.6 9.1-.7 13.1L35.8 55.1c-2 2.4-5.6 2.4-7.6 0L13.6 37.3c-3.3-4-3.7-9.6-.7-13.1Z"
      />
    </svg>
  )
}

function SignatureY({ mobile = false }: { mobile?: boolean }) {
  return (
    <svg
      viewBox="0 0 38 48"
      className={cn("overflow-visible", mobile ? "h-[26px] w-[21px]" : "h-[35px] w-[28px]")}
      aria-hidden="true"
    >
      <circle cx="18" cy="11" r="5.2" fill="#FF5A1F" />
      <path
        d="M4.5 10.5c1.8 9.5 7 14.4 14 14.4 7.3 0 12.4-5 14.1-14.4M32.5 10.5c-.5 17.5-6.2 27-17.5 29.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="6.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function BrandLogo({ href = "/", compact = false, mobile = false, className }: BrandLogoProps) {
  const content = compact ? (
    <span className={cn("inline-flex items-center", className)} aria-label="EnjoyHub">
      <SmileMark small={mobile} />
    </span>
  ) : (
    <span
      className={cn(
        "inline-flex items-center font-black leading-none tracking-[-0.075em] text-[#0B1220] dark:text-white",
        mobile ? "text-[1.28rem]" : "text-[1.8rem] md:text-[2rem]",
        className,
      )}
      aria-label="EnjoyHub"
    >
      <span>enjo</span>
      <span className="-mx-[0.03em] inline-flex text-[#0B1220] dark:text-white">
        <SignatureY mobile={mobile} />
      </span>
      <span className="text-[#FF5A1F]">hub</span>
    </span>
  )

  if (!href) return content

  return (
    <Link
      href={href}
      className="inline-flex items-center rounded-xl outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      {content}
    </Link>
  )
}
