import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/next'
import { I18nProvider } from '@/components/i18n-provider'
import { SiteHeader } from '@/components/site-header'
import './globals.css'

// Note: Using CSS-based Poppins font due to build environment network restrictions
// Font is loaded via @import in globals.css

export const metadata: Metadata = {
  title: 'v0 App',
  description: 'Created with v0',
  generator: 'v0.app',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pl">
      <body className="font-poppins antialiased">
        <I18nProvider locale="pl">
          <SiteHeader />
          {children}
        </I18nProvider>
        <Analytics />
      </body>
    </html>
  )
}
