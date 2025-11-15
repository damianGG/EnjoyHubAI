"use client"

import { Button } from "@/components/ui/button"
import { Search } from "lucide-react"
import Link from "next/link"

export function TopNav({ onSearchClick }: { onSearchClick?: () => void }) {
  return (
    <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold">E</span>
            </div>
            <span className="text-xl font-bold hidden md:inline">EnjoyHub</span>
          </Link>

          {/* Large Search Button - Centered */}
          <div className="flex-1 flex justify-center px-4">
            <Button
              onClick={onSearchClick}
              variant="outline"
              size="lg"
              className="w-full max-w-2xl bg-white hover:bg-gray-50 border-2 justify-start text-left font-normal h-14 rounded-full shadow-sm"
            >
              <Search className="h-5 w-5 mr-3 text-muted-foreground" />
              <span className="text-base text-muted-foreground">Wyszukaj</span>
            </Button>
          </div>

          {/* Empty space for symmetry */}
          <div className="w-8 h-8" />
        </div>
      </div>
    </div>
  )
}
