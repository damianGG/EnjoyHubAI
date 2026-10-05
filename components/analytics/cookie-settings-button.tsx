"use client"

import { POSTHOG_OPEN_SETTINGS_EVENT } from "@/lib/posthog-browser"

export function CookieSettingsButton() {
  return (
    <button
      type="button"
      className="hover:text-foreground hover:underline"
      onClick={() => window.dispatchEvent(new Event(POSTHOG_OPEN_SETTINGS_EVENT))}
    >
      Ustawienia cookies
    </button>
  )
}
