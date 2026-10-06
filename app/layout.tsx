import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "myrota — use what you own",
    template: "%s · myrota",
  },
  description:
    "Turn the skincare you already own into a simple seven-day routine and stick to it.",
  applicationName: "myrota",
  appleWebApp: {
    capable: true,
    title: "myrota",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#171714",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
