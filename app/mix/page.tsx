"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Wordmark } from "@/components/brand/Wordmark";
import { ProductTile } from "@/components/rota/parts";
import { MixPickSheet } from "@/components/sheets/product";
import { BackButton } from "@/components/ui/primitives";
import { useFlow, type MixPick } from "@/lib/client/flow";
import { useResource } from "@/lib/client/runtime";
import type { ProductCategory } from "@/lib/domain/types";
import { COLOR } from "@/lib/ui/ring";

export default function MixPage() {
  const router = useRouter();
  const { flow, update } = useFlow();
  const shelf = useResource((r) => r.shelf().catch(() => ({ products: [] })));
  const [picking, setPicking] = useState<"a" | "b" | null>(null);
  const slot = (k: "a" | "b", pick: MixPick | null) => (
    <button
      key={k}
      type="button"
      onClick={() => setPicking(k)}
      className="row"
      style={{ width: "100%", borderRadius: 18, padding: 12, textAlign: "left", background: pick ? COLOR.porcelain : COLOR.pearl, border: `2px ${pick ? "solid" : "dashed"} ${pick ? COLOR.ebony : COLOR.honey}`, minHeight: 68, ["--gap" as string]: "12px" }}
      aria-label={`${k === "a" ? "First" : "Second"} product: ${pick ? pick.name : "choose a product"}`}
    >
      <ProductTile category={(pick?.category as ProductCategory) ?? "other"} unknown={pick?.ref.kind === "unknown"} />
      <div className="grow">
        <div className="t-label" style={{ fontSize: 11, color: COLOR.lagoon }}>{k === "a" ? "First product" : "Second product"}</div>
        <div className="t-strong" style={{ fontSize: 15 }}>{pick ? pick.name : "Choose a product"}</div>
      </div>
    </button>
  );
  const ready = !!flow.mixA && !!flow.mixB;
  return (
    <div className="app-frame app-frame--lagoon">
      <main id="main" className="app-main" style={{ minHeight: "100dvh" }}>
        <section className="grain grain--lagoon on-dark" style={{ padding: "calc(20px + env(safe-area-inset-top)) 22px 40px", display: "flex", flexDirection: "column", gap: 16, minHeight: 250 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <BackButton onDark fallback="/" />
            <Wordmark size={22} ink={COLOR.porcelain} accent={COLOR.apricot} />
          </div>
          <div style={{ marginTop: "auto" }}>
            <span className="t-kicker">Mix Check</span>
            <h1 className="t-display" style={{ fontSize: 33, lineHeight: 1.02, marginTop: 6 }}>Can these two share a routine?</h1>
          </div>
        </section>
        <section className="stack grow" style={{ background: COLOR.porcelain, color: COLOR.ebony, borderRadius: "28px 28px 0 0", marginTop: -20, position: "relative", padding: "22px 20px calc(22px + env(safe-area-inset-bottom))", ["--gap" as string]: "10px" }}>
          {slot("a", flow.mixA)}
          {slot("b", flow.mixB)}
          <p className="t-note t-muted" style={{ margin: "2px 4px" }}>One verdict with the reasons. If we can't confirm something, we say so, and we never call an unknown pair compatible.</p>
          <button type="button" className="btn btn--primary btn--lg btn--block mt-auto" disabled={!ready} onClick={() => router.push("/mix/result")}>Check the mix</button>
        </section>
      </main>
      <MixPickSheet
        open={!!picking}
        onClose={() => setPicking(null)}
        slot={picking ?? "a"}
        shelf={shelf.data?.products ?? []}
        onPick={(pick) => {
          update(picking === "a" ? { mixA: pick } : { mixB: pick });
          setPicking(null);
        }}
        onScan={() => {
          update({ scanFor: "mix", mixSlot: picking ?? "a" });
          setPicking(null);
          router.push("/add/scan?for=mix");
        }}
      />
    </div>
  );
}
