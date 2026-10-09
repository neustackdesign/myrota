import type { NextConfig } from "next";

/**
 * Pilot Vercel frontend uses its own URL for every /api request.
 * Vercel proxies to the dedicated myrota Cloudflare Worker, preserving
 * browser same-origin URLs for cookies and eliminating third-party fetch.
 *
 * MYROTA_API_ORIGIN exists only so a local harness can point at a local
 * Worker (e.g. http://127.0.0.1:8787). Production/Preview leave it unset and
 * use the dedicated Worker below. It never proxies another project's data.
 */
const API_ORIGIN = (process.env.MYROTA_API_ORIGIN || "https://myrota.neustackdesign.workers.dev").replace(/\/$/, "");

/** v1.2 deep links keep working: they now live under the v1.6 PWA at /app. */
const LEGACY = ["today", "shelf", "friends", "rota", "build", "mix", "add", "week", "settings", "i"];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return {
      beforeFiles: [{ source: "/api/:path*", destination: `${API_ORIGIN}/api/:path*` }],
      afterFiles: [],
      fallback: [],
    };
  },
  async redirects() {
    return LEGACY.flatMap((p) => [
      { source: `/${p}`, destination: `/app/${p}`, permanent: false },
      { source: `/${p}/:rest*`, destination: `/app/${p}/:rest*`, permanent: false },
    ]);
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
