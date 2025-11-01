import type { Metadata } from 'next'
import './globals.css'
import { Analytics } from '@vercel/analytics/next'
// TODO: Re-enable Poppins font once network restrictions are resolved in build environment
// import { Poppins } from 'next/font/google'
import SiteHeader from '../components/site-header'
import I18nProvider from '../components/i18n-provider'
import pl from '../locales/pl'

// const poppins = Poppins({
//   subsets: ['latin', 'latin-ext'],
//   weight: ['300', '400', '500', '600', '700'],
//   display: 'swap',
// })

export const metadata: Metadata = {
  title: 'EnjoyHubAI',
  description: 'EnjoyHubAI',
  generator: 'EnjoyHubAI',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pl">
      <body className="font-sans antialiased">
        <I18nProvider locale="pl" messages={pl}>
          <SiteHeader />
          {children}
          <Analytics />
        </I18nProvider>
      </body>
    </html>
  )
}
