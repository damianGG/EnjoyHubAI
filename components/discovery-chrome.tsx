"use client"

import dynamic from "next/dynamic"
import { useState, type ReactNode } from "react"

import { TopNav } from "@/components/top-nav"
import { BottomNav } from "@/components/bottom-nav"
import { CategoryBar } from "@/components/category-bar"

const SearchDialog = dynamic(
  () => import("@/components/search-dialog").then((mod) => ({ default: mod.SearchDialog })),
  { ssr: false }
)

export function DiscoveryChrome({ children }: { children: ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-50">
        <TopNav onSearchClick={() => setSearchOpen(true)} />
        <CategoryBar useNavigation />
      </div>
      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
      {children}
      <div className="hidden md:block">
        <BottomNav onSearchClick={() => setSearchOpen(true)} />
      </div>
    </div>
  )
}
