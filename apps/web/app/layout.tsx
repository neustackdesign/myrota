import type { Metadata, Viewport } from "next";
import { Faculty_Glyphic, Geist, Geist_Mono } from "next/font/google";
import { PwaRegister } from "@/components/pwa-register";
import { PUBLIC_MARKETING } from "@/lib/marketing/content";
import "./globals.css";
import "./dc-states.css";

// Licensed typography via next/font (Google Fonts, OFL). No extracted font binaries are shipped.
const faculty = Faculty_Glyphic({ weight: "400", subsets: ["latin", "latin-ext"], variable: "--font-faculty-glyphic", display: "swap" });
const geist = Geist({ subsets: ["latin", "latin-ext"], variable: "--font-geist", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin", "latin-ext"], weight: ["400", "500"], variable: "--font-geist-mono", display: "swap" });

export const metadata: Metadata = {
  metadataBase: process.env.VERCEL_URL ? new URL(`https://${process.env.VERCEL_BRANCH_URL || process.env.VERCEL_URL}`) : undefined,
  title: { default: PUBLIC_MARKETING.seo.title, template: PUBLIC_MARKETING.seo.titleTemplate },
  description: PUBLIC_MARKETING.seo.description,
  applicationName: PUBLIC_MARKETING.seo.applicationName,
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "myrota", statusBarStyle: "default" },
  openGraph: {
    type: "website",
    siteName: "myrota",
    title: PUBLIC_MARKETING.seo.title,
    description: PUBLIC_MARKETING.seo.description,
  },
  twitter: {
    card: "summary_large_image",
    title: PUBLIC_MARKETING.seo.title,
    description: PUBLIC_MARKETING.seo.description,
  },
};

export const viewport: Viewport = {
  themeColor: "#1E3A3C",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-GB" className={`${faculty.variable} ${geist.variable} ${geistMono.variable}`}>
      <body>
        <a className="skip-link" href="#main">Skip to content</a>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
