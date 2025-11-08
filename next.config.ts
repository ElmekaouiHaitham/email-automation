import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  env: {
    BACKEND_API_URL: process.env.BACKEND_API_URL || "http://127.0.0.1:8000",
  },
};

export default nextConfig;
