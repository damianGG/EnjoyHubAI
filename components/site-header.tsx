'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClientComponentClient, type User } from '@supabase/auth-helpers-nextjs'
import { useT } from './i18n-provider'

export default function SiteHeader() {
  const t = useT()
  const router = useRouter()
  const supabase = createClientComponentClient()
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    let isMounted = true

    supabase.auth.getUser().then(({ data }) => {
      if (!isMounted) return
      setUser(data.user ?? null)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      router.refresh()
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [router, supabase])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-50 border-b bg-white/70 dark:bg-neutral-900/70 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-neutral-900/60">
      <nav className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:h-16 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <Link href="/" className="font-semibold">
            EnjoyHubAI
          </Link>
          {/* Example future nav links */}
          {/* <Link href="/oferty" className="text-sm text-muted-foreground hover:text-foreground">{t('nav.explore')}</Link> */}
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              {/* <Link href="/rezerwacje" className="text-sm hover:underline">{t('nav.bookings')}</Link> */}
              {/* <Link href="/dodaj-obiekt" className="text-sm hover:underline">{t('nav.add_property')}</Link> */}
              <button
                type="button"
                onClick={handleSignOut}
                className="rounded-md border px-3 py-1.5 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800"
              >
                {t('nav.logout')}
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="rounded-md border px-3 py-1.5 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800"
              >
                {t('nav.login')}
              </Link>
              <Link
                href="/signup"
                className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
              >
                {t('nav.signup')}
              </Link>
            </div>
          )}
        </div>
      </nav>
    </header>
  )
}
