"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Search, Heart, MessageCircle, User } from "lucide-react"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { icon: Search, label: "Odkrywaj", href: "/" },
  { icon: Heart, label: "Ulubione", href: "/favorites" },
  { icon: MessageCircle, label: "Wiadomości", href: "/messages" },
  { icon: User, label: "Profil", href: "/profile" },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t md:hidden">
      <div className="flex items-center justify-around h-16">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors",
                isActive 
                  ? "text-primary" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className={cn("h-5 w-5", isActive && "fill-primary")} />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
