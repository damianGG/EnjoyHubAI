import type { Metadata } from 'next'
// TODO: Re-enable Google Fonts once network restrictions are resolved in build environment
// Temporarily disabled Google Fonts due to network restrictions in build environment
// import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { AnalyticsPageTracker } from '@/components/analytics/page-tracker'
import { getPublicSiteUrl } from '@/lib/site-url'
import './globals.css'

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

const siteUrl = getPublicSiteUrl()
const defaultTitle = 'EnjoyHub – atrakcje i bilety'
const defaultDescription = 'Znajdź atrakcje, sprawdź dostępne terminy i zarezerwuj miejsce online.'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: 'EnjoyHub',
  title: {
    default: defaultTitle,
    template: '%s | EnjoyHub',
  },
  description: defaultDescription,
  openGraph: {
    type: 'website',
    locale: 'pl_PL',
    siteName: 'EnjoyHub',
    title: defaultTitle,
    description: defaultDescription,
  },
  twitter: {
    card: 'summary_large_image',
    title: defaultTitle,
    description: defaultDescription,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  icons: {
    icon: '/enjoyhub-icon.svg',
    shortcut: '/enjoyhub-icon.svg',
    apple: '/enjoyhub-icon.svg',
  },
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
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        {/* Preconnect to Cloudinary for faster image loading */}
        <link rel="preconnect" href="https://res.cloudinary.com" />
        <link rel="dns-prefetch" href="https://res.cloudinary.com" />
        {/* MapTiler vector basemap and MapLibre runtime */}
        <link rel="preconnect" href="https://api.maptiler.com" />
        <link rel="dns-prefetch" href="https://api.maptiler.com" />
        <link rel="preconnect" href="https://unpkg.com" />
      </head>
      <body className="font-sans antialiased min-h-screen bg-background">
        {children}
        <AnalyticsPageTracker />
        <Analytics />
      </body>
    </html>
  )
}
