import { notFound } from "next/navigation";
import { InfoPage } from "@/components/site/InfoPage";

const PAGES: Record<string, { title: string; body: React.ReactNode }> = {
  privacy: {
    title: "Privacy in this pilot",
    body: (
      <>
        <p><b>Draft for the closed pilot, pending legal review.</b> This page describes what the pilot build actually does today.</p>
        <h2 id="data">What myrota stores</h2>
        <ul>
          <li>A guest account created when you first save something (no email, phone or name is required).</li>
          <li>The products you add to your shelf: names you type, ingredient lists you paste, and where you chose to use them.</li>
          <li>Your seven-day rota and the dated check-ins you mark (morning, evening or rest).</li>
          <li>A display name, only if you add one.</li>
        </ul>
        <p>This data is stored in myrota&apos;s own database on Cloudflare (D1). It is not shared with other apps, sold, or used for advertising.</p>
        <h2>What myrota does not store</h2>
        <ul>
          <li>Your answers about pregnancy, breastfeeding or prescription treatments are sent only to build that rota and are not saved.</li>
          <li>Photos: photo reading is not switched on in the pilot, so no label photos are uploaded.</li>
          <li>Your avatar look is saved only in this browser.</li>
        </ul>
        <h2 id="cookies">Cookies</h2>
        <p>myrota uses one strictly necessary session cookie so your guest rota stays yours. There are no advertising or analytics cookies, so there is nothing to opt into. Bot protection by Cloudflare Turnstile runs when your guest account is created.</p>
        <h2>Deleting your data</h2>
        <p>You can remove any product from your shelf in the app. To delete your whole guest account during the pilot, contact the person who invited you to the pilot; a self-serve delete is being built.</p>
      </>
    ),
  },
  terms: {
    title: "Pilot terms",
    body: (
      <>
        <p><b>Draft for the closed pilot, pending legal review.</b> Full terms will be published before public launch.</p>
        <p>myrota is a pilot. Features may change, and some parts of the design (photo reading, Rescue, friends, reminders, saving to an account) are not switched on yet. When something isn&apos;t available, the app says so instead of pretending.</p>
        <p>myrota gives general information about ordering and spacing products you already own. It is <a href="/legal/not-medical-advice">not medical advice</a>.</p>
      </>
    ),
  },
  "not-medical-advice": {
    title: "Not medical advice",
    body: (
      <>
        <p>myrota gives general information about ordering and spacing skincare you already own. It does not diagnose, treat or prevent any condition.</p>
        <p>Until a pharmacist or dermatologist has reviewed a rule, myrota does not schedule strong actives such as retinoids or exfoliants and does not call any pair of products compatible: it shows &ldquo;Not enough evidence&rdquo;.</p>
        <p>A product with no warning in myrota is not thereby safe or authentic. myrota reads only what a label declares.</p>
        <p>If you are pregnant, breastfeeding, using a prescription treatment, or your skin is irritated, check with a pharmacist or doctor.</p>
      </>
    ),
  },
};

export function generateStaticParams() {
  return Object.keys(PAGES).map((slug) => ({ slug }));
}

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = PAGES[slug];
  if (!page) notFound();
  return <InfoPage kicker="Legal" title={page.title}>{page.body}</InfoPage>;
}
