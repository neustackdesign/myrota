import type { Metadata, Viewport } from "next";
import { Faculty_Glyphic, Geist, Geist_Mono } from "next/font/google";
import { PwaRegister } from "@/components/pwa-register";
import { DemoBar, ToastProvider } from "@/components/ui/primitives";
import { FlowProvider } from "@/lib/client/flow";
import { RuntimeProvider } from "@/lib/client/runtime";
import "./globals.css";

const faculty = Faculty_Glyphic({ weight: "400", subsets: ["latin"], variable: "--font-faculty-glyphic", display: "swap" });
const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-geist-mono", display: "swap" });

export const metadata: Metadata = {
  title: { default: "myrota — a seven-day rota from your own shelf", template: "%s · myrota" },
  description: "Add the skincare you already own. Get a seven-day morning and evening rota, follow it, and keep a streak with a friend.",
  applicationName: "myrota",
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "myrota", statusBarStyle: "default" },
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
