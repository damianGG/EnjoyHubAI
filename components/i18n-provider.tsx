"use client"

import { createContext, useContext, type ReactNode } from "react"
import { pl } from "@/locales/pl"
import { en } from "@/locales/en"
import type { Translations } from "@/locales/pl"

type Locale = "pl" | "en"

interface I18nContextValue {
  locale: Locale
  t: (key: string) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

const translations: Record<Locale, Translations> = {
  pl,
  en,
}

function getNestedValue(obj: any, path: string): string {
  const keys = path.split(".")
  let value = obj

  for (const key of keys) {
    if (value && typeof value === "object" && key in value) {
      value = value[key]
    } else {
      return path // Return the key if not found
    }
  }

  return typeof value === "string" ? value : path
}

interface I18nProviderProps {
  children: ReactNode
  locale?: Locale
}

export function I18nProvider({ children, locale = "pl" }: I18nProviderProps) {
  const t = (key: string): string => {
    const translation = translations[locale]
    return getNestedValue(translation, key)
  }

  return (
    <I18nContext.Provider value={{ locale, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useT() {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error("useT must be used within an I18nProvider")
  }
  return context.t
}
