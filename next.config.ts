import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  // Next's development gzip streaming retains drain listeners under backpressure.
  compress: process.env.NODE_ENV !== "development"
};

export default nextConfig;
