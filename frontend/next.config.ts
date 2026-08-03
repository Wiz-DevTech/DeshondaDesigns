import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export — served by the Cloudflare Worker via Workers Assets.
  output: "export",
  // next/image with fill + static export requires unoptimized images.
  images: { unoptimized: true },
};

export default nextConfig;
