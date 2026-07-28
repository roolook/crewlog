import { NextResponse } from "next/server";

/**
 * "It runs in the phone's browser and pins to the home screen like an app."
 * standalone display + the paper background is what makes that true.
 */
export function GET() {
  return NextResponse.json({
    name: "CrewLog",
    short_name: "CrewLog",
    description: "Your spreadsheet, back as an app your team actually uses.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#EDEBE6",
    theme_color: "#EDEBE6",
    icons: [
      {
        src: "/assets/favicon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      { src: "/assets/og-image.png", sizes: "512x512", type: "image/png" },
    ],
  });
}
