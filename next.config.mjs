/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
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
    // Enable image formats for better performance
    formats: ['image/avif', 'image/webp'],
    // Set device sizes for responsive images
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    // Set image sizes for responsive images
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  // Optimize runtime chunks for better caching
  experimental: {
    optimizePackageImports: ['leaflet', 'lucide-react', '@radix-ui/react-dialog', '@radix-ui/react-select'],
    // Enable output file tracing for smaller builds
    outputFileTracingRoot: undefined,
  },
  // Add compression
  compress: true,
  // Enable React strict mode for better development experience
  reactStrictMode: true,
  // Optimize production builds
  swcMinify: true,
  // Performance budgets
  onDemandEntries: {
    // Period (in ms) where the server will keep pages in the buffer
    maxInactiveAge: 60 * 1000,
    // Number of pages that should be kept simultaneously without being disposed
    pagesBufferLength: 5,
  },
}

export default nextConfig
