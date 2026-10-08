import type { Metadata, Viewport } from "next";
import { Faculty_Glyphic, Geist, Geist_Mono } from "next/font/google";
import { PwaRegister } from "@/components/pwa-register";
import { DemoBar, ToastProvider } from "@/components/ui/primitives";
import { FlowProvider } from "@/lib/client/flow";
import { RuntimeProvider } from "@/lib/client/runtime";
import { PUBLIC_MARKETING } from "@/lib/marketing/content";
import { PHOTO_ASSETS } from "@/lib/assets/manifest";
import "./globals.css";

const faculty = Faculty_Glyphic({ weight: "400", subsets: ["latin"], variable: "--font-faculty-glyphic", display: "swap" });
const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-geist-mono", display: "swap" });

export const metadata: Metadata = {
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
    images: PHOTO_ASSETS.ogImage.src ? [{ url: PHOTO_ASSETS.ogImage.src, width: 1200, height: 630, alt: "myrota skincare routine" }] : [],
  },
  twitter: {
    card: "summary_large_image",
    title: PUBLIC_MARKETING.seo.title,
    description: PUBLIC_MARKETING.seo.description,
    images: PHOTO_ASSETS.ogImage.src ? [PHOTO_ASSETS.ogImage.src] : [],
  },
};

export const viewport: Viewport = {
  themeColor: "#F7EFE7",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${faculty.variable} ${geist.variable} ${geistMono.variable}`}>
      <body>
        <a className="skip-link" href="#main">Skip to content</a>
        <RuntimeProvider>
          <FlowProvider>
            <ToastProvider>
              <DemoBar />
              <PwaRegister />
              {children}
            </ToastProvider>
          </FlowProvider>
        </RuntimeProvider>
      </body>
    </html>
  );
}
