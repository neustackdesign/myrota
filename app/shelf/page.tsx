"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { RotaMarker } from "@/components/brand/RotaMarker";
import { CATEGORY_LABEL, ProductTile, ProvenanceLine, SafetyFlagCard, ShelfCheck } from "@/components/rota/parts";
import { ChipSheet, ProductDetailSheet } from "@/components/sheets/product";
import { Button, ErrorBlock, InlineError, LoadingBlock, Sheet, TabBar, useToast } from "@/components/ui/primitives";
import type { PatchShelfRequest } from "@/lib/api/contract";
import { useFlow } from "@/lib/client/flow";
import { useAccepted, useRepository, useResource } from "@/lib/client/runtime";
import { isAnalysable, visibleSafetyFlags } from "@/lib/domain/evidence";
import type { InciIngredient, RotaSnapshot, ShelfProduct } from "@/lib/domain/types";
import { COLOR } from "@/lib/ui/ring";

function sessionsOf(rota: RotaSnapshot | null, id: string) {
  if (!rota) return { am: false, pm: false };
  return {
    am: rota.days.some((d) => d.am.some((s) => s.productId === id)),
    pm: rota.days.some((d) => d.pm.some((s) => s.productId === id)),
  };
}

export default function ShelfPage() {
  const router = useRouter();
  const repo = useRepository();
  const accepted = useAccepted();
  const toast = useToast();
  const { update } = useFlow();
  const shelf = useResource((r) => r.shelf());
  const rota = useResource((r) => r.currentRota());
  const [openId, setOpenId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);

  const products = shelf.data?.products ?? [];
  const current = rota.data?.rota ?? null;
  const held = new Set(current?.held.map((h) => h.productId) ?? []);
  const active = products.filter((p) => !p.finishedAt);
  const inRota = active.filter((p) => isAnalysable(p) && !visibleSafetyFlags(p, accepted).length && !held.has(p.id));
  const offRota = active.filter((p) => !inRota.includes(p));
  const finished = products.filter((p) => p.finishedAt);
  const flagged = products.flatMap((p) => visibleSafetyFlags(p, accepted).map((f) => ({ f, p })));
  const openProduct = products.find((p) => p.id === openId) ?? null;

  const patch = async (id: string, body: PatchShelfRequest, key: string, message: string) => {
    setBusy(key);
    setError(null);
    try {
      const p = await repo.patchProduct(id, body);
      shelf.setData((s) => ({ products: (s?.products ?? []).map((x) => (x.id === id ? p : x)) }));
      toast(message);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  };

  const row = (p: ShelfProduct, offRotaRow = false) => {
    const s = sessionsOf(current, p.id);
    const analysable = isAnalysable(p);
    const flaggedP = visibleSafetyFlags(p, accepted).length > 0;
    const placementMeta = p.placement === "am" ? "Mornings · your choice" : p.placement === "pm" ? "Evenings · your choice" : "On your shelf, not in your rota";
    return (
      <li key={p.id}>
        <button type="button" className="product-row" onClick={() => setOpenId(p.id)}>
          <ProductTile category={p.category} unknown={!analysable} />
          <div className="grow">
            <div className="t-strong">{p.name || "Unnamed product"}</div>
            <div className="t-small t-muted">{offRotaRow ? (flaggedP ? "Kept out of your rota · see note above" : held.has(p.id) && analysable ? "Waiting for a reviewed rule · not scheduled" : placementMeta) : [p.brand, CATEGORY_LABEL[p.category]].filter(Boolean).join(" · ")}</div>
            {!offRotaRow ? <ProvenanceLine product={p} /> : null}
          </div>
          {offRotaRow ? (
            <span className="tag tag--resting">{flaggedP ? "Not scheduled" : analysable ? "Held" : "Unknown"}</span>
          ) : (
            <span className="row" style={{ ["--gap" as string]: "4px" }}>
              {s.am ? <span className="tag tag--am">AM</span> : null}
              {s.pm ? <span className="tag tag--pm">PM</span> : null}
            </span>
          )}
        </button>
      </li>
    );
  };

  return (
    <div className="app-frame has-tabbar">
      <main id="main" className="app-main">
        <div className="pad top-pad row" style={{ justifyContent: "space-between", alignItems: "flex-end", paddingBottom: 10 }}>
          <h1 className="t-display" style={{ fontSize: 32, lineHeight: 1 }}>Shelf</h1>
          <div className="row" style={{ ["--gap" as string]: "8px" }}>
            <Link className="btn" href="/mix" onClick={() => update({ source: "mix", mixA: null, mixB: null })}><RotaMarker icon="mix" size={22} />Mix</Link>
            <Link className="btn" href="/build?src=shelf" onClick={() => update({ source: "shelf" })}><RotaMarker icon="add" size={20} />Add</Link>
          </div>
        </div>

        {shelf.loading && !shelf.data ? <div className="pad"><LoadingBlock label="Loading your shelf" /></div> : null}
        {shelf.error ? <div className="pad"><ErrorBlock error={shelf.error} onRetry={shelf.reload} title="We couldn't load your shelf" /></div> : null}

        {shelf.data && !products.length ? (
          <div className="pad stack">
            <div className="grain grain--sea" style={{ height: 220, borderRadius: 22, display: "grid", placeItems: "center" }}>
              <RotaMarker icon="shelf" size={96} mode="colour" />
            </div>
            <h2 className="t-display t-h3">Nothing here yet.</h2>
            <p className="t-body t-muted">Add what's already in your bathroom. We'll build the rota around it.</p>
            <Link className="btn btn--rescue btn--lg btn--block" href="/build?src=organic"><RotaMarker icon="add" size={20} />Add a product</Link>
          </div>
        ) : null}

        {products.length ? (
          <>
            {flagged.length ? (
              <div className="pad stack" style={{ ["--gap" as string]: "10px", marginTop: 8 }}>
                {flagged.map(({ f, p }) => <SafetyFlagCard key={`${p.id}-${f.id}`} flag={f} productName={p.name} demo={repo.mode === "demo"} />)}
              </div>
            ) : null}
            {current ? <div className="pad" style={{ marginTop: 10 }}><ShelfCheck items={current.shelfCheck} /></div> : null}
            {rota.error ? <div className="pad" style={{ marginTop: 10 }}><InlineError error={rota.error} /></div> : null}
            <section className="pad" style={{ marginTop: 18 }} aria-labelledby="in-rota">
              <h2 id="in-rota" className="t-kicker t-sienna" style={{ margin: "0 0 4px" }}>In your rota · {inRota.length}</h2>
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>{inRota.map((p) => row(p))}</ul>
            </section>
            {offRota.length ? (
              <section className="pad" style={{ marginTop: 20 }} aria-labelledby="off-rota">
                <h2 id="off-rota" className="t-kicker t-muted" style={{ margin: "0 0 4px" }}>Unknown or not scheduled · not analysed</h2>
                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>{offRota.map((p) => row(p, true))}</ul>
              </section>
            ) : null}
            {finished.length ? (
              <section className="pad" style={{ marginTop: 20, opacity: 0.7 }} aria-labelledby="finished">
                <h2 id="finished" className="t-kicker t-muted" style={{ margin: "0 0 4px" }}>Finished · left out of your next rota</h2>
                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>{finished.map((p) => row(p, true))}</ul>
              </section>
            ) : null}
            <p className="pad t-small t-muted" style={{ margin: "18px 0 24px" }}>Changes apply to your rota from tomorrow, never mid-day.</p>
          </>
        ) : null}
      </main>
      <TabBar />
      <ProductDetailSheet
        open={!!openProduct}
        onClose={() => { setOpenId(null); setError(null); }}
        product={openProduct}
        accepted={accepted}
        demo={repo.mode === "demo"}
        busy={busy}
        error={error}
        onCorrect={() => { setEditId(openId); setOpenId(null); }}
        onRescan={() => { setOpenId(null); update({ scanFor: "shelf" }); router.push("/add/scan?for=shelf"); }}
        onPatch={(body) => openProduct && patch(openProduct.id, body, body.finished !== undefined ? "finished" : "placement", body.finished !== undefined ? (body.finished ? "Marked finished. Your rota updates tomorrow." : "Back on your shelf") : "Timing saved. Your rota updates tomorrow.")}
        onRemove={async () => {
          if (!openProduct) return;
          setBusy("remove");
          setError(null);
          try {
            await repo.removeProduct(openProduct.id);
            shelf.setData((s) => ({ products: (s?.products ?? []).filter((x) => x.id !== openProduct.id) }));
            setOpenId(null);
            toast("Removed");
          } catch (e) {
            setError(e);
          } finally {
            setBusy(null);
          }
        }}
      />
      <EditSheet
        product={products.find((p) => p.id === editId) ?? null}
        onClose={() => setEditId(null)}
        onSaved={(p) => { shelf.setData((s) => ({ products: (s?.products ?? []).map((x) => (x.id === p.id ? p : x)) })); setEditId(null); toast("Saved as your correction"); }}
      />
    </div>
  );
}

function EditSheet({ product, onClose, onSaved }: { product: ShelfProduct | null; onClose: () => void; onSaved: (p: ShelfProduct) => void }) {
  const repo = useRepository();
  const [name, setName] = useState("");
  const [corrections, setCorrections] = useState<{ ingredientId: string; text: string | null }[]>([]);
  const [chip, setChip] = useState<InciIngredient | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    setName(product?.name ?? "");
    setCorrections([]);
    setError(null);
  }, [product]);
  if (!product) return null;
  const shown = product.ingredients
    .filter((i) => !corrections.some((c) => c.ingredientId === i.id && c.text === null))
    .map((i) => {
      const c = corrections.find((x) => x.ingredientId === i.id);
      return c ? { ...i, text: c.text!, status: "corrected" as const } : i;
    });
  return (
    <>
      <Sheet open={!chip} onClose={onClose} labelledBy="edit-title">
        <div className="stack">
          <h2 id="edit-title" className="t-display t-h2">Correct details</h2>
          <label className="field">
            <span className="t-label">Name</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <span className="t-label">Ingredients</span>
          <div className="chip-row">
            {shown.map((i) => (
              <button key={i.id} type="button" className={`chip ${i.status === "unreadable" ? "chip--unreadable" : i.status === "corrected" ? "chip--corrected" : ""}`} onClick={() => setChip(i)}>
                {i.status === "unreadable" ? "unreadable" : i.text}{i.status === "corrected" ? " · edited" : ""}
              </button>
            ))}
            {!shown.length ? <span className="t-note t-muted">No ingredients recorded. Re-scan the back label to add them.</span> : null}
          </div>
          <p className="t-note t-muted">Your corrections stay on your shelf as edits. They don't count as verified and aren't used in pairing until confirmed.</p>
          <InlineError error={error} />
          <Button
            variant="primary"
            busy={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                const body: PatchShelfRequest = {};
                if (name.trim() && name.trim() !== product.name) body.name = name.trim();
                if (corrections.length) body.ingredientCorrections = corrections;
                onSaved(Object.keys(body).length ? await repo.patchProduct(product.id, body) : product);
              } catch (e) {
                setError(e);
              } finally {
                setBusy(false);
              }
            }}
          >
            Save correction
          </Button>
          <div style={{ height: 2, background: COLOR.porcelain }} />
        </div>
      </Sheet>
      <ChipSheet
        open={!!chip}
        onClose={() => setChip(null)}
        ingredient={chip}
        onSave={(text) => { setCorrections((c) => [...c.filter((x) => x.ingredientId !== chip!.id), { ingredientId: chip!.id, text }]); setChip(null); }}
        onRemove={() => { setCorrections((c) => [...c.filter((x) => x.ingredientId !== chip!.id), { ingredientId: chip!.id, text: null }]); setChip(null); }}
      />
    </>
  );
}
