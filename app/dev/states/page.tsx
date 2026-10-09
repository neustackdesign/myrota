import { notFound } from "next/navigation";
import { DEMO_MODE } from "@/lib/client/runtime";
import { StatesGallery } from "@/components/devstates/StatesGallery";

export const metadata = { title: "Design states (demo)", robots: { index: false, follow: false } };

/**
 * DEMO-ONLY design-review gallery of the 65 Prototype v1.6 scenario states.
 * 404 unless the build sets NEXT_PUBLIC_MYROTA_DEMO=1; the release preview
 * builds with =0, so this never ships to stakeholders or real users.
 */
export default function StatesPage() {
  if (!DEMO_MODE) notFound();
  return <StatesGallery />;
}
