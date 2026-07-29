import type { NextConfig } from "next";

const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.sheetjs.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data: https:;
  font-src 'self' data:;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'self';
  upgrade-insecure-requests;
`.replace(/\s{2,}/g, " ").trim();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Lets a verification build write somewhere other than `.next` (see the
  // `build:check` script). Running `next build` into the same directory a dev
  // server is serving from replaces its chunks mid-flight, and the dev server
  // then dies with "Cannot find module './###.js'".
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // The tenant app is embedded in an iframe on the landing page and the
  // preview page, so frame-ancestors is set to 'self'.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: cspHeader },
        ],
      },
    ];
  },
};

export default nextConfig;
