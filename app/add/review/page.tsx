"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { CATEGORY_LABEL, ProductTile, SafetyFlagCard } from "@/components/rota/parts";
import { ChipSheet } from "@/components/sheets/product";
import { BackButton, Button, InlineError, useToast } from "@/components/ui/primitives";
import { draftFromCandidate } from "@/lib/client/drafts";
import { useFlow } from "@/lib/client/flow";
import { useAccepted, useRepository } from "@/lib/client/runtime";
import { confirmIdentity, correctIngredient, isAnalysable, removeIngredient, visibleSafetyFlags } from "@/lib/domain/evidence";
import type { EvidenceStatus, InciIngredient, ProductCategory, ShelfProduct } from "@/lib/domain/types";

const CATEGORIES: ProductCategory[] = ["cleanser", "toner", "serum", "treatment", "moisturiser", "sunscreen", "other"];

const IDENTITY_BADGE: Record<EvidenceStatus, [string, "good" | "mid" | "low"]> = {
  verified: ["Name · matched to library", "good"],
  user_confirmed: ["Name · you confirmed", "mid"],
  corrected: ["Name · you changed it", "mid"],
  partial: ["Name · read from label", "mid"],
  unknown: ["Name · not read", "low"],
};
const INCI_BADGE: Record<EvidenceStatus, [string, "good" | "mid" | "low"]> = {
  verified: ["Ingredients · verified", "good"],
  user_confirmed: ["Ingredients · you confirmed", "mid"],
  corrected: ["Ingredients · you corrected, awaiting confirmation", "mid"],
  partial: ["Ingredients · partly read", "low"],
  unknown: ["Ingredients · not read", "low"],
};

function chipClass(ing: InciIngredient, analysable: boolean) {
  if (ing.status === "unreadable") return "chip chip--unreadable";
  if (ing.status === "corrected") return "chip chip--corrected";
  if (ing.flagged) return "chip chip--flag";
  if (ing.activeClass && analysable) return "chip chip--active";
  return "chip";
}

function Review() {
  const router = useRouter();
  const params = useSearchParams();
  const repo = useRepository();
  const accepted = useAccepted();
  const toast = useToast();
  const { flow, update } = useFlow();
  const [product, setProduct] = useState<ShelfProduct | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [chip, setChip] = useState<InciIngredient | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!flow.draft) return;
    const d = draftFromCandidate(flow.draft, flow.draftMethod ?? "scan");
    const t = new Date().toISOString();
    setProduct({ ...d, id: "draft", flags: flow.draft.flags, createdAt: t, updatedAt: t });
    setNameDraft(flow.draft.name ?? "");
  }, [flow.draft, flow.draftMethod]);

  const flags = useMemo(() => (product ? visibleSafetyFlags(product, accepted) : []), [product, accepted]);

  if (!flow.draft || !product) {
    return (
      <div className="app-frame">
        <main id="main" className="app-main pad top-pad stack">
          <div className="row"><BackButton fallback="/build" /></div>
          <div className="state-block">
            <b>Nothing to review</b>
            <p className="t-note t-muted">Scans aren't kept, so a reload clears this step. Scan or paste the label again.</p>
            <Link className="btn btn--primary btn--lg btn--block" href="/build">Add a product</Link>
          </div>
        </main>
      </div>
    );
  }

  const analysable = isAnalysable(product);
  const askFront = !product.name && !params.get("front");
  const unreadable = product.ingredients.filter((i) => i.status === "unreadable").length;
  const [idText, idTone] = IDENTITY_BADGE[product.identityStatus];
  const [inText, inTone] = INCI_BADGE[product.inciStatus];
  const target = flow.scanFor;
  const cta = target === "mix" ? "Use in Mix Check" : flags.length ? "Keep on shelf, out of rota" : "Add to shelf";

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const named = nameDraft.trim() && nameDraft.trim() !== product.name ? confirmIdentity(product, nameDraft.trim()) : product;
      const res = await repo.addProduct({
        brand: named.brand,
        name: named.name || "Unnamed product",
        category: named.category,
        format: named.format,
        identityStatus: named.identityStatus,
        inciStatus: named.inciStatus,
        identityKey: named.identityStatus === "verified" ? named.identityKey : null,
        variant: named.variant,
        ingredients: named.ingredients,
        placement: isAnalysable(named) ? undefined : "none",
        source: named.source,
        extractionId: flow.draft!.extractionId,
      });
      update({ draft: null, draftMethod: null });
      if (target === "mix") {
        const pick = { ref: { kind: "shelf" as const, shelfProductId: res.product.id }, name: res.product.name, category: res.product.category };
        update(flow.mixSlot === "a" ? { mixA: pick } : { mixB: pick });
        router.replace("/mix");
      } else {
        toast(res.duplicate ? "Already on your shelf" : flags.length ? "On your shelf, kept out of your rota" : "Added to your shelf");
        router.replace(target === "shelf" ? "/shelf" : `/build?src=${flow.source}`);
      }
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app-frame">
      <main id="main" className="app-main" style={{ minHeight: "100dvh" }}>
        <div className="pad top-pad stack grow" style={{ ["--gap" as string]: "14px", paddingBottom: 16 }}>
          <div className="row">
            <BackButton fallback="/build" />
            <span className="t-kicker t-muted" style={{ marginLeft: "auto" }}>Check what we read</span>
          </div>
          <div className="row" style={{ ["--gap" as string]: "12px" }}>
            <ProductTile category={product.category} unknown={!analysable} large />
            <div className="grow">
              <h1 className="t-display t-h3" style={{ fontSize: 24 }}>{nameDraft || "Name not read yet"}</h1>
              <div className="t-note t-muted">{product.brand || "Brand as printed on the label"}</div>
            </div>
          </div>
          <div className="chip-row" aria-label="How sure we are">
            <span className={`badge badge--${idTone}`}>{idText}</span>
            <span className={`badge badge--${inTone}`}>{inText}</span>
          </div>
          {askFront ? (
            <Link className="callout-dashed" href={`/add/scan?side=front&for=${target}`}>
              <span className="grow t-body"><b>We couldn't read the name.</b> Snap the front label, or type it below.</span>
              <span className="t-strong t-ink-link">Snap</span>
            </Link>
          ) : null}
          {flags.map((f) => <SafetyFlagCard key={f.id} flag={f} demo={repo.mode === "demo"} />)}

          <label className="field">
            <span className="t-label">Name</span>
            <input className="input" value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} placeholder="Type the product name" />
          </label>
          <div className="field">
            <span className="t-label" id="type-label">Type</span>
            <div className="chip-row" role="group" aria-labelledby="type-label">
              {CATEGORIES.map((c) => (
                <button key={c} type="button" className="pill-choice" aria-pressed={product.category === c} onClick={() => setProduct({ ...product, category: c })}>
                  {CATEGORY_LABEL[c]}
                </button>
              ))}
            </div>
          </div>
          <div className="segmented" role="group" aria-label="Rinse-off or leave-on">
            <button type="button" aria-pressed={product.format === "rinse_off"} onClick={() => setProduct({ ...product, format: "rinse_off" })}>Rinse-off</button>
            <button type="button" aria-pressed={product.format === "leave_on"} onClick={() => setProduct({ ...product, format: "leave_on" })}>Leave-on</button>
          </div>
          <div className="field">
            <span className="t-label" id="ing-label">Ingredients we read</span>
            {product.ingredients.length ? (
              <div className="chip-row" role="list" aria-labelledby="ing-label">
                {product.ingredients.map((ing) => (
                  <span role="listitem" key={ing.id}>
                    <button type="button" className={chipClass(ing, analysable)} onClick={() => setChip(ing)} aria-label={`${ing.status === "unreadable" ? "Unreadable line" : ing.text}${ing.status === "corrected" ? ", edited by you" : ""}. Tap to correct`}>
                      {ing.status === "unreadable" ? "unreadable" : ing.text}
                      {ing.status === "corrected" ? " · edited" : ""}
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="note note--sienna" style={{ margin: 0 }}>No ingredients left. This product will go on your shelf as unknown.</p>
            )}
            <span className="t-note t-muted">Tap an ingredient to correct it.</span>
            {unreadable ? <span className="t-note t-muted">{unreadable === 1 ? "One line was" : `${unreadable} lines were`} too blurred to read. Until it's confirmed, this product stays out of pairing checks.</span> : null}
            {product.inciStatus === "corrected" ? <span className="t-note t-muted">Your edits stay on your shelf as corrections. They aren't used in pairing or scheduling until confirmed.</span> : null}
          </div>
          <p className="t-note t-muted">We only read what the label declares. No flag doesn't mean a product is safe or authentic.</p>
        </div>
        <div className="pad stack" style={{ position: "sticky", bottom: 0, background: "#FBFAF6", borderTop: "1px solid #EEF0EC", padding: "12px 20px calc(16px + env(safe-area-inset-bottom))", ["--gap" as string]: "8px" }}>
          <InlineError error={error} />
          <Button variant="primary" busy={busy} onClick={save}>{cta}</Button>
          <Link className="btn btn--text" href={`/add/scan?for=${target}`}>Retake photo</Link>
        </div>
      </main>
      <ChipSheet
        open={!!chip}
        onClose={() => setChip(null)}
        ingredient={chip}
        onSave={(text) => {
          setProduct(correctIngredient(product, chip!.id, text));
          setChip(null);
        }}
        onRemove={() => {
          setProduct(removeIngredient(product, chip!.id));
          setChip(null);
        }}
      />
    </div>
  );
}

export default function ReviewPage() {
  return (
    <Suspense fallback={null}>
      <Review />
    </Suspense>
  );
}
