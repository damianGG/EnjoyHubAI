import type { Metadata } from 'next'
// TODO: Re-enable Google Fonts once network restrictions are resolved in build environment
// Temporarily disabled Google Fonts due to network restrictions in build environment
// import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import 'leaflet/dist/leaflet.css'

// const geist = Geist({ 
//   subsets: ["latin"],
//   display: 'swap',
//   fallback: ['system-ui', 'arial']
// })
// const geistMono = Geist_Mono({ 
//   subsets: ["latin"],
//   display: 'swap',
//   fallback: ['monospace']
// })

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
      <head>
        {/* Load Poppins from Google Fonts at runtime (external hosting) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className="font-sans antialiased min-h-screen bg-gradient-to-br from-sky-400/20 via-violet-500/20 to-rose-400/20 dark:from-[#0b1220] dark:via-[#0f172a] dark:to-[#0b1220]"
      >
        {children}
        <Analytics />
      </body>
    </html>
  )
}
