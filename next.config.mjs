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
    optimizePackageImports: ['leaflet', 'lucide-react'],
  },
  // Add compression
  compress: true,
  // Enable React strict mode for better development experience
  reactStrictMode: true,
}

export default nextConfig
