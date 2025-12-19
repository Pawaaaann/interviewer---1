import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Image optimization for better performance
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ik.imagekit.io",
        port: "",
      },
      {
        protocol: "https",
        hostname: "cdn.jsdelivr.net",
        port: "",
      },
    ],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  async rewrites() {
    return [];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          // Add cache control for better performance
          ...(process.env.NODE_ENV === "development" ? [
            {
              key: "Cache-Control",
              value: "no-cache, no-store, must-revalidate",
            },
          ] : []),
        ],
      },
    ];
  },
  // Enable experimental features
  experimental: {
    optimizePackageImports: ["lucide-react", "@radix-ui/react-slot"],
  },
};

export default nextConfig;
