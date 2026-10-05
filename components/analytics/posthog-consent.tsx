"use client"

import Script from "next/script"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"

import {
  POSTHOG_CONSENT_STORAGE_KEY,
  POSTHOG_OPEN_SETTINGS_EVENT,
  type AnalyticsConsent,
  getPostHog,
} from "@/lib/posthog-browser"

const projectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN?.trim()
const apiHost = process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || "https://us.i.posthog.com"

function buildPostHogSnippet(token: string, host: string) {
  const safeToken = JSON.stringify(token)
  const safeHost = JSON.stringify(host)

  return `!function(t,e){var o,n,p,r;e.__SV||(window.posthog&&window.posthog.__loaded)||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}p||((p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",p.onerror=function(){p=null},(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r));var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],Object.defineProperty(u,"toString",{configurable:!0,enumerable:!0,writable:!0,value:function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e}}),Object.defineProperty(u.people,"toString",{configurable:!0,enumerable:!0,writable:!0,value:function(){return u.toString(1)+".people (stub)"}}),o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagResult isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);posthog.init(${safeToken},{api_host:${safeHost},defaults:"2026-05-30"});`
}

function readStoredConsent(): AnalyticsConsent | null {
  const value = window.localStorage.getItem(POSTHOG_CONSENT_STORAGE_KEY)
  return value === "accepted" || value === "rejected" ? value : null
}

export function PostHogConsent() {
  const [consent, setConsent] = useState<AnalyticsConsent | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const snippet = useMemo(
    () => (projectToken ? buildPostHogSnippet(projectToken, apiHost) : ""),
    [],
  )

  useEffect(() => {
    if (!projectToken) return

    const storedConsent = readStoredConsent()
    setConsent(storedConsent)
    setShowSettings(storedConsent === null)

    const openSettings = () => setShowSettings(true)
    window.addEventListener(POSTHOG_OPEN_SETTINGS_EVENT, openSettings)
    return () => window.removeEventListener(POSTHOG_OPEN_SETTINGS_EVENT, openSettings)
  }, [])

  const acceptAnalytics = () => {
    window.localStorage.setItem(POSTHOG_CONSENT_STORAGE_KEY, "accepted")
    getPostHog()?.opt_in_capturing?.()
    getPostHog()?.startSessionRecording?.()
    setConsent("accepted")
    setShowSettings(false)
  }

  const rejectAnalytics = () => {
    window.localStorage.setItem(POSTHOG_CONSENT_STORAGE_KEY, "rejected")
    getPostHog()?.stopSessionRecording?.()
    getPostHog()?.opt_out_capturing?.()
    setConsent("rejected")
    setShowSettings(false)
  }

  if (!projectToken) return null

  return (
    <>
      {consent === "accepted" ? (
        <Script
          id="posthog-loader"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{ __html: snippet }}
        />
      ) : null}

      {showSettings ? (
        <div className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-3xl rounded-3xl border bg-background/95 p-5 shadow-2xl backdrop-blur sm:bottom-5 sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-xl">
              <p className="text-base font-semibold">Pomóż nam ulepszać EnjoyHub</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Za Twoją zgodą używamy PostHog do analizy sposobu korzystania z serwisu,
                map kliknięć i nagrań sesji. Pola formularzy są maskowane. Dzięki temu
                możemy szybciej znajdować miejsca, w których użytkownicy mają problem.
              </p>
              <Link className="mt-2 inline-block text-sm text-primary hover:underline" href="/privacy#cookies">
                Więcej o prywatności
              </Link>
            </div>
            <div className="flex shrink-0 flex-col-reverse gap-2 sm:flex-row">
              <button
                type="button"
                onClick={rejectAnalytics}
                className="rounded-full border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
              >
                Tylko niezbędne
              </button>
              <button
                type="button"
                onClick={acceptAnalytics}
                className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                Akceptuję analitykę
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
