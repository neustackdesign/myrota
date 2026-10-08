"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { PhotoSlot } from "@/components/brand/PhotoSlot";
import { Wordmark } from "@/components/brand/Wordmark";
import { PUBLIC_MARKETING } from "@/lib/marketing/content";
import { useFlow } from "@/lib/client/flow";
import { useResource } from "@/lib/client/runtime";

export default function LandingPage() {
  const router = useRouter();
  const copy = PUBLIC_MARKETING.landing;
  const { update } = useFlow();
  const me = useResource((repo) => repo.me());
  return (
    <div className="app-frame app-frame--pearl app-frame--wide">
      <main id="main" className="app-main split">
        <section className="grain grain--sunrise" style={{ padding: "calc(28px + env(safe-area-inset-top)) 16px 0", display: "flex", flexDirection: "column", gap: 18 }} aria-label="myrota">
          <div style={{ paddingLeft: 8 }}><Wordmark size={30} /></div>
          <PhotoSlot asset={copy.heroAsset} style={{ width: "100%", maxHeight: 460 }} />
        </section>
        <section className="pad stack screen-enter" style={{ padding: "22px 24px calc(24px + env(safe-area-inset-bottom))", ["--gap" as string]: "12px", justifyContent: "center" }}>
          <h1 className="t-display t-hero">{copy.heading}</h1>
          <p className="t-lede t-muted">{copy.description}</p>
          <div className="stack center" style={{ marginTop: 16, ["--gap" as string]: "8px" }}>
            <button
              type="button"
              className="btn btn--primary btn--lg btn--block"
              onClick={() => {
                update({ source: "organic", mixCarry: null });
                router.push("/build?src=organic");
              }}
            >
              {copy.primaryCta}
            </button>
            <Link href="/mix" className="btn btn--text">{copy.secondaryCta}</Link>
            <span className="t-note t-muted">{copy.valueLine}</span>
            {me.data?.hasRota ? (
              <Link href="/today" className="btn btn--text">{copy.returningCta}</Link>
            ) : null}
          </div>
          <p className="t-small t-muted" style={{ marginTop: 18 }}>
            {copy.labelDisclaimer}
          </p>
        </section>
      </main>
    </div>
  );
}
