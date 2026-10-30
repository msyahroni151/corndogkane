import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/admin-malam/dashboard", destination: "/menu-utama/dashboard", permanent: true },
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
