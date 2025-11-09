"use client"

import { Search } from "lucide-react"
import { Button } from "@/components/ui/button"

interface SearchBarProps {
  onSearchClick: () => void
}

export function SearchBar({ onSearchClick }: SearchBarProps) {
  return (
    <Button
      variant="outline"
      onClick={onSearchClick}
      className="w-full md:w-auto md:min-w-[400px] justify-start text-left font-normal h-12 rounded-full border-2 shadow-sm hover:shadow-md transition-shadow"
    >
      <Search className="mr-2 h-4 w-4 text-muted-foreground" />
      <div className="flex items-center space-x-2 md:space-x-4 text-sm">
        <span className="font-medium">Gdzie?</span>
        <span className="hidden md:inline text-muted-foreground">|</span>
        <span className="hidden md:inline font-medium">Kiedy?</span>
        <span className="hidden md:inline text-muted-foreground">|</span>
        <span className="hidden md:inline font-medium">Ile osób?</span>
      </div>
    </Button>
  )
}
