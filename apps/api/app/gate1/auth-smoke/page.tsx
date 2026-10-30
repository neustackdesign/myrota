import type { Metadata } from "next";
import { Gate1AuthSmoke } from "@/components/gate1-auth-smoke";

export const metadata: Metadata = {
  title: "myrota Gate 1 auth smoke",
  robots: { index: false, follow: false },
};

export default function Gate1AuthSmokePage() {
  return <Gate1AuthSmoke />;
}
