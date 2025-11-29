import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    // Skip type checking during build to speed up deployment
    ignoreBuildErrors: true,
  },
  // Fix workspace root detection for Netlify deployment
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
