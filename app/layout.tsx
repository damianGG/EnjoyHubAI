import type { Metadata } from 'next'
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
    <html lang="en">
      <body className="font-sans antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  )
}
