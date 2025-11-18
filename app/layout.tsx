import type { Metadata } from 'next'
// TODO: Re-enable Google Fonts once network restrictions are resolved in build environment
// Temporarily disabled Google Fonts due to network restrictions in build environment
// import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
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
        {/* Leaflet CSS for map functionality */}
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin=""
        />
        {/* Preconnect to Cloudinary for faster image loading */}
        <link rel="preconnect" href="https://res.cloudinary.com" />
        <link rel="dns-prefetch" href="https://res.cloudinary.com" />
        {/* Preconnect to CDN for map tiles */}
        <link rel="preconnect" href="https://a.basemaps.cartocdn.com" />
        <link rel="preconnect" href="https://b.basemaps.cartocdn.com" />
        <link rel="preconnect" href="https://c.basemaps.cartocdn.com" />
        <link rel="preconnect" href="https://d.basemaps.cartocdn.com" />
      </head>
      <body
        className="font-sans antialiased min-h-screen bg-background dark:from-[#0b1220] dark:via-[#0f172a] dark:to-[#0b1220]"
      >
        {children}
        <Analytics />
      </body>
    </html>
  )
}
