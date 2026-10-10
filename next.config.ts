import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hotel, airline and map thumbnails come from many Google/TripAdvisor CDNs.
  images: { unoptimized: true },
  devIndicators: false,
};

export default nextConfig;
