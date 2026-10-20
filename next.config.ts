import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
