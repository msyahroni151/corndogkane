import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/admin-malam/dashboard", destination: "/menu-utama/dashboard", permanent: true },
    ];
  },
  poweredByHeader: false,
  images: { unoptimized: true },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), geolocation=(self), microphone=(), payment=(), usb=()",
          },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
        ],
      },
    ];
  },
  devIndicators: false,
  // Folder terpisah untuk pengujian lokal; build normal tetap menggunakan .next.
  distDir: process.env.HRIS_TEST_DIST_DIR || ".next",
  cacheComponents: false,
  experimental: { cpus: 2 },
  partialPrefetching: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
