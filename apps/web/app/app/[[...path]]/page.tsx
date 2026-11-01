import type { Metadata } from "next";
import { AppShell } from "@/components/app/AppShell";

export const metadata: Metadata = { title: "Your rota", robots: { index: false, follow: false } };

/** The myrota PWA (Prototype v1.6 experience) on the real Worker + D1 API. One client shell; sub-paths are URL-synced screens. */
export default function AppPage() {
  return <AppShell />;
}
