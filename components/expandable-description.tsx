"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface ExpandableDescriptionProps {
  description: string
  shortDescription?: string
}

export function ExpandableDescription({ description, shortDescription }: ExpandableDescriptionProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  
  // Use short description if provided, otherwise truncate the full description
  const displayShort = shortDescription || (description.length > 300 ? description.substring(0, 300) + "..." : description)
  const shouldShowToggle = shortDescription ? true : description.length > 300

  return (
    <Card>
      <CardHeader>
        <CardTitle>Opis</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
            {isExpanded ? description : displayShort}
          </p>
          {shouldShowToggle && (
            <Button
              variant="link"
              className="h-auto p-0 font-semibold"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? "Pokaż mniej" : "Pokaż więcej"} →
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
