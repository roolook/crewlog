import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Lets a verification build write somewhere other than `.next` (see the
  // `build:check` script). Running `next build` into the same directory a dev
  // server is serving from replaces its chunks mid-flight, and the dev server
  // then dies with "Cannot find module './###.js'".
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // The tenant app is embedded in an iframe on the landing page and the
  // preview page, so it must not be blocked by a global frame-ancestors deny.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
};

export default nextConfig;
