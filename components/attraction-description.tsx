"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

interface AttractionDescriptionProps {
  shortDescription: string
  fullDescription: string
}

export default function AttractionDescription({
  shortDescription,
  fullDescription,
}: AttractionDescriptionProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const showToggle = fullDescription.length > 200

  if (!fullDescription) {
    return null
  }

  return (
    <div className="space-y-4">
      <div className="prose max-w-none">
        <p className="text-muted-foreground leading-relaxed">
          {isExpanded ? fullDescription : shortDescription}
          {!isExpanded && showToggle && "..."}
        </p>
      </div>

      {showToggle && (
        <Button
          variant="link"
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-0 h-auto font-semibold"
        >
          {isExpanded ? "Pokaż mniej" : "Pokaż więcej"}
        </Button>
      )}
    </div>
  )
}
