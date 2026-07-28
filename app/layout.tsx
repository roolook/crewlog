import type { Metadata, Viewport } from "next";
import { Archivo, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["500", "700", "900"],
  variable: "--font-archivo",
  display: "swap",
});

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-plex-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

const description =
  "Send us the spreadsheet you run on and tell us what it should do. A person builds it into a phone app — map pins, photos, signatures, whatever the job needs — in 48 hours. Flat $10/month, no per-seat pricing.";

export const metadata: Metadata = {
  title: "CrewLog — your spreadsheet, rebuilt as the app you needed",
  description,
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
  openGraph: {
    title: "CrewLog — your spreadsheet, rebuilt as the app you needed",
    description,
    type: "website",
    images: ["/assets/og-image.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "CrewLog — your spreadsheet, rebuilt as the app you needed",
    description,
    images: ["/assets/og-image.png"],
  },
  icons: { icon: "/assets/favicon.svg" },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#EDEBE6",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${plexSans.variable} ${plexMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
