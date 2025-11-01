'use client'

import React, { createContext, useContext, useMemo } from 'react'

type Messages = Record<string, string | Messages>

type I18nContextValue = {
  locale: string
  t: (key: string) => string
}

const I18nContext = createContext<I18nContextValue>({
  locale: 'pl',
  t: (key) => key,
})

function resolveKey(messages: Messages, path: string): string | undefined {
  const parts = path.split('.')
  let current: any = messages
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = (current as any)[part]
    } else {
      return undefined
    }
  }
  return typeof current === 'string' ? current : undefined
}

export default function I18nProvider({
  locale,
  messages,
  children,
}: {
  locale: string
  messages: Messages
  children: React.ReactNode
}) {
  const value = useMemo<I18nContextValue>(() => {
    return {
      locale,
      t: (key: string) => resolveKey(messages, key) ?? key,
    }
  }, [locale, messages])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useT() {
  return useContext(I18nContext).t
}
