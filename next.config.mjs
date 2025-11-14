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
    ],
  },
  // Optimize runtime chunks for better caching
  experimental: {
    optimizePackageImports: ['leaflet'],
  },
  // Add compression
  compress: true,
  // Enable React strict mode for better development experience
  reactStrictMode: true,
}

export default nextConfig
