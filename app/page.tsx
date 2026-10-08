"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { PhotoSlot } from "@/components/brand/PhotoSlot";
import { Wordmark } from "@/components/brand/Wordmark";
import { useFlow } from "@/lib/client/flow";
import { useResource } from "@/lib/client/runtime";

export default function LandingPage() {
  const router = useRouter();
  const { update } = useFlow();
  const me = useResource((repo) => repo.me());
  return (
    <div className="app-frame app-frame--pearl app-frame--wide">
      <main id="main" className="app-main split">
        <section className="grain grain--sunrise" style={{ padding: "calc(28px + env(safe-area-inset-top)) 16px 0", display: "flex", flexDirection: "column", gap: 18 }} aria-label="myrota">
          <div style={{ paddingLeft: 8 }}><Wordmark size={30} /></div>
          <PhotoSlot asset="landingHero" style={{ width: "100%", maxHeight: 460 }} />
        </section>
        <section className="pad stack screen-enter" style={{ padding: "22px 24px calc(24px + env(safe-area-inset-bottom))", ["--gap" as string]: "12px", justifyContent: "center" }}>
          <h1 className="t-display t-hero">A seven-day rota from what's already on your shelf.</h1>
          <p className="t-lede t-muted">Add the products you own. We'll plan your mornings and evenings so the strong ones take turns, and tell you plainly when we can't confirm something.</p>
          <div className="stack center" style={{ marginTop: 16, ["--gap" as string]: "8px" }}>
            <button
              type="button"
              className="btn btn--primary btn--lg btn--block"
              onClick={() => {
                update({ source: "organic", mixCarry: null });
                router.push("/build?src=organic");
              }}
            >
              Add my products
            </button>
            <Link href="/mix" className="btn btn--text">Or check two products together</Link>
            <span className="t-note t-muted">No account. No download. About a minute.</span>
            {me.data?.hasRota ? (
              <Link href="/today" className="btn btn--text">Continue my rota →</Link>
            ) : null}
          </div>
          <p className="t-small t-muted" style={{ marginTop: 18 }}>
            myrota reads what labels declare. It doesn't diagnose, and no warning doesn't mean a product is safe or authentic.
          </p>
        </section>
      </main>
    </div>
  );
}
