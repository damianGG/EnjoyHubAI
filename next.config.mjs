import { withSentryConfig } from "@sentry/nextjs/config"

/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: '/properties/:id',
        destination: '/attractions/:id',
        permanent: true,
      },
      {
        source: '/host/properties',
        destination: '/host/sprzedaz/konfiguracja',
        permanent: true,
      },
      {
        source: '/host/properties/:path*',
        destination: '/host/sprzedaz/konfiguracja',
        permanent: true,
      },
      {
        source: '/host/bookings',
        destination: '/host/sprzedaz',
        permanent: true,
      },
    ]
  },
  eslint: {
    // Lint runs as a dedicated CI step. This avoids running ESLint twice during builds.
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      {
        protocol: "https",
        hostname: "via.placeholder.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-dialog', '@radix-ui/react-select'],
  },
  compress: true,
  reactStrictMode: true,
}

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  widenClientFileUpload: true,
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
  },
})
