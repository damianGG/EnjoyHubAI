"use client"

import { Button } from "@/components/ui/button"
import { Share2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

interface ShareButtonProps {
  title: string
  description?: string
  className?: string
  variant?: "default" | "outline" | "ghost" | "link"
  size?: "default" | "sm" | "lg" | "icon"
}

export function ShareButton({ 
  title, 
  description, 
  className,
  variant = "outline",
  size = "default"
}: ShareButtonProps) {
  const [isSharing, setIsSharing] = useState(false)

  const handleShare = async () => {
    setIsSharing(true)
    
    try {
      // Check if native share is available
      if (navigator.share) {
        await navigator.share({
          title: title,
          text: description || "",
          url: window.location.href,
        })
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(window.location.href)
        toast.success("Link skopiowany do schowka!")
      }
    } catch (err) {
      // User cancelled or other error
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error("Error sharing:", err)
        toast.error("Nie udało się udostępnić")
      }
    } finally {
      setIsSharing(false)
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={handleShare}
      disabled={isSharing}
      aria-label="Udostępnij"
    >
      <Share2 className={`h-4 w-4 ${size !== "icon" ? "mr-2" : ""}`} />
      {size !== "icon" && "Udostępnij"}
    </Button>
  )
}
