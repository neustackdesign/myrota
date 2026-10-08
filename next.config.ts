import type { NextConfig } from "next";

/**
 * Pilot Vercel frontend uses its own URL for every /api request.
 * Vercel proxies to the dedicated myrota Cloudflare Worker, preserving
 * browser same-origin URLs for cookies and eliminating third-party fetch.
 *
 * Do NOT ship before the browser cookie + CSRF + Turnstile hostname smoke
 * test passes. This configuration never proxies another project's data.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/api/:path*",
          destination: "https://myrota.neustackdesign.workers.dev/api/:path*",
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
