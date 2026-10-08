import type { Metadata } from "next";

// Privacy-safe link preview: no inviter identity or products in OG text.
export const metadata: Metadata = {
  title: "You're invited to myrota",
  description: "Build your own seven-day skincare rota from what you already own, and keep a streak together.",
  openGraph: {
    title: "A friend invited you to myrota",
    description: "Build your own rota from your own shelf. You'll see each other's streak, never products.",
    type: "website",
  },
};

export default function InviteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
