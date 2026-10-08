"use client";

import { useEffect, useState } from "react";
import { RotaMarker } from "@/components/brand/RotaMarker";
import { CATEGORY_LABEL, ProductTile, ProvenanceLine, SafetyFlagCard } from "@/components/rota/parts";
import { Button, InlineError, Sheet } from "@/components/ui/primitives";
import { useRepository } from "@/lib/client/runtime";
import type { MixPick } from "@/lib/client/flow";
import { isAnalysable, visibleSafetyFlags } from "@/lib/domain/evidence";
import type { AcceptedStatuses, CatalogueProduct, InciIngredient, ShelfProduct, UserPlacement } from "@/lib/domain/types";
import { COLOR } from "@/lib/ui/ring";

const PLACEMENTS: [UserPlacement, string][] = [
  ["am", "Morning"],
  ["pm", "Evening"],
  ["none", "Not in rota"],
];

export function ProductDetailSheet({
  open,
  onClose,
  product,
  accepted,
  demo,
  onCorrect,
  onRescan,
  onPatch,
  onRemove,
  busy,
  error,
}: {
  open: boolean;
  onClose: () => void;
  product: ShelfProduct | null;
  accepted: AcceptedStatuses;
  demo: boolean;
  onCorrect: () => void;
  onRescan: () => void;
  onPatch: (patch: { placement?: UserPlacement; finished?: boolean }) => void;
  onRemove: () => void;
  busy: string | null;
  error: unknown;
}) {
  if (!product) return null;
  const analysable = isAnalysable(product);
  const flags = visibleSafetyFlags(product, accepted);
  const placement = product.placement ?? "none";
  return (
    <Sheet open={open} onClose={onClose} labelledBy="pd-title">
      <div className="stack">
        <div className="row" style={{ ["--gap" as string]: "12px" }}>
          <ProductTile category={product.category} unknown={!analysable} large />
          <div className="grow">
            {!analysable ? <div className="t-kicker t-sienna">{product.inciStatus === "corrected" ? "Corrected · not analysed yet" : "Unknown product"}</div> : null}
            <h2 id="pd-title" className="t-display t-h3">{product.name || "Unnamed product"}</h2>
            <div className="t-small t-muted">{[product.brand, CATEGORY_LABEL[product.category]].filter(Boolean).join(" · ")}</div>
            <ProvenanceLine product={product} />
          </div>
        </div>
        {flags.map((f) => <SafetyFlagCard key={f.id} flag={f} demo={demo} />)}
        {!analysable && !flags.length ? (
          <>
            <p className="t-body t-muted">We couldn't confirm what's in it, so we won't check it against your other products. It goes where you choose, marked "not analysed".</p>
            <div className="field">
              <span className="t-label">When you use it</span>
              <div className="segmented" role="group" aria-label="When you use it">
                {PLACEMENTS.map(([v, t]) => (
                  <button key={v} type="button" aria-pressed={placement === v} onClick={() => onPatch({ placement: v })}>{t}</button>
                ))}
              </div>
            </div>
          </>
        ) : null}
        <p className="t-note t-muted">Corrections stay on your shelf until we can confirm them. Changes apply to your rota from tomorrow.</p>
        <InlineError error={error} />
        <div className="divider-list" style={{ display: "flex", flexDirection: "column" }}>
          {[
            { t: "Correct details", act: onCorrect, key: "correct" },
            { t: "Re-scan the label", act: onRescan, key: "rescan" },
            { t: product.finishedAt ? "Not finished after all" : "Mark as finished", act: () => onPatch({ finished: !product.finishedAt }), key: "finished" },
            { t: "Remove from shelf", act: onRemove, key: "remove" },
          ].map((a) => (
            <button key={a.key} type="button" onClick={a.act} disabled={busy === a.key} className="row" style={{ justifyContent: "space-between", minHeight: 50, background: "none", border: 0, fontWeight: 600, fontSize: 15, textAlign: "left" }}>
              {a.t}
              {busy === a.key ? <span className="spinner" aria-hidden style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid", borderRightColor: "transparent", animation: "spin 800ms linear infinite" }} /> : <span aria-hidden className="t-muted">›</span>}
            </button>
          ))}
        </div>
      </div>
    </Sheet>
  );
}

export function PasteSheet({ open, onClose, onRead, busy, error }: { open: boolean; onClose: () => void; onRead: (text: string) => void; busy: boolean; error: unknown }) {
  const [text, setText] = useState("");
  return (
    <Sheet open={open} onClose={onClose} labelledBy="paste-title">
      <form className="stack" onSubmit={(e) => { e.preventDefault(); if (text.trim()) onRead(text.trim()); }}>
        <h2 id="paste-title" className="t-display t-h2">Paste the ingredient list</h2>
        <p className="t-body t-muted">Copy it from the brand's site or the box. We read it the same way as a scan, and you check it before anything is saved.</p>
        <label className="field">
          <span className="sr-only">Ingredient list</span>
          <textarea className="textarea" rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder="Aqua, Glycerin, Niacinamide, …" />
        </label>
        <InlineError error={error} />
        <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={!text.trim() || busy} aria-busy={busy || undefined}>
          {busy ? <span className="spinner" aria-hidden /> : null}Read ingredients
        </button>
      </form>
    </Sheet>
  );
}

export function ChipSheet({ open, onClose, ingredient, onSave, onRemove }: { open: boolean; onClose: () => void; ingredient: InciIngredient | null; onSave: (text: string) => void; onRemove: () => void }) {
  const [draft, setDraft] = useState("");
  useEffect(() => {
    if (open) setDraft(ingredient && ingredient.status !== "unreadable" ? ingredient.text : "");
  }, [open, ingredient]);
  if (!ingredient) return null;
  return (
    <Sheet open={open} onClose={onClose} labelledBy="chip-title">
      <form className="stack" onSubmit={(e) => { e.preventDefault(); if (draft.trim()) onSave(draft.trim()); }}>
        <h2 id="chip-title" className="t-display t-h2">{ingredient.status === "unreadable" ? "What does this line say?" : `Correct “${ingredient.text}”`}</h2>
        <label className="field">
          <span className="sr-only">Ingredient as printed</span>
          <input className="input" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Type it as printed" autoCapitalize="words" />
        </label>
        <p className="t-body t-muted">Your correction is marked “edited”. It isn't used in pairing or scheduling until it's confirmed.</p>
        <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={!draft.trim()}>Save correction</button>
        <Button variant="text-muted" onClick={onRemove}>It's not on the label</Button>
      </form>
    </Sheet>
  );
}

export function UnknownSheet({ open, onClose, name, onAdd, busy, error }: { open: boolean; onClose: () => void; name: string; onAdd: (placement: UserPlacement) => void; busy: boolean; error: unknown }) {
  const [placement, setPlacement] = useState<UserPlacement>("pm");
  return (
    <Sheet open={open} onClose={onClose} labelledBy="unknown-title">
      <div className="stack">
        <div className="row" style={{ ["--gap" as string]: "12px" }}>
          <ProductTile category="other" unknown large />
          <div>
            <div className="t-kicker t-sienna">Unknown product</div>
            <h2 id="unknown-title" className="t-display t-h3">“{name}”</h2>
          </div>
        </div>
        <p className="t-body t-muted">It isn't in our library, so we won't guess what's in it or check it against your other products. It goes on your shelf as Unknown. Scan its back label any time to tell us more.</p>
        <span className="t-label">When do you use it?</span>
        <div className="segmented" role="group" aria-label="When do you use it?">
          {PLACEMENTS.map(([v, t]) => (
            <button key={v} type="button" aria-pressed={placement === v} onClick={() => setPlacement(v)}>{v === "none" ? "Not yet" : t}</button>
          ))}
        </div>
        <InlineError error={error} />
        <Button variant="primary" busy={busy} onClick={() => onAdd(placement)}>Add to shelf as unknown</Button>
      </div>
    </Sheet>
  );
}

export function MixPickSheet({
  open,
  onClose,
  slot,
  shelf,
  onPick,
  onScan,
}: {
  open: boolean;
  onClose: () => void;
  slot: "a" | "b";
  shelf: ShelfProduct[];
  onPick: (pick: MixPick) => void;
  onScan: () => void;
}) {
  const repo = useRepository();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<CatalogueProduct[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    const t = setTimeout(() => {
      repo
        .searchCatalogue(q)
        .then((r) => alive && (setResults(r.results), setError(null)))
        .catch((e) => alive && setError(e))
        .finally(() => alive && setLoading(false));
    }, 180);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q, open, repo]);
  const query = q.trim();
  const exact = results.some((r) => r.name.toLowerCase() === query.toLowerCase());
  const shelfMatches = shelf.filter((p) => !query || p.name.toLowerCase().includes(query.toLowerCase()));
  return (
    <Sheet open={open} onClose={onClose} labelledBy="mixpick-title">
      <div className="stack" style={{ ["--gap" as string]: "10px" }}>
        <h2 id="mixpick-title" className="t-display t-h3" style={{ fontSize: 24 }}>Pick the {slot === "a" ? "first" : "second"} product</h2>
        <label className="search">
          <span className="sr-only">Search brand or product</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search brand or product" autoFocus />
        </label>
        <Button onClick={onScan}><span className="scan-glyph" aria-hidden />Scan the label</Button>
        {query.length > 2 && !exact ? (
          <button type="button" className="unknown-add" onClick={() => onPick({ ref: { kind: "unknown", name: query }, name: query, category: "other" })}>
            <ProductTile category="other" unknown />
            <div><div className="t-strong">Use “{query}”</div><div className="t-small t-muted">Not in our library. We won't guess.</div></div>
          </button>
        ) : null}
        {shelfMatches.length ? <span className="t-kicker t-sienna" style={{ marginTop: 6 }}>On your shelf</span> : null}
        {shelfMatches.map((p) => (
          <button key={p.id} type="button" className="product-row" onClick={() => onPick({ ref: { kind: "shelf", shelfProductId: p.id }, name: p.name, category: p.category })}>
            <ProductTile category={p.category} unknown={!isAnalysable(p)} />
            <div className="grow"><div className="t-strong">{p.name}</div><div className="t-small t-muted">{p.brand || "As printed"} · {CATEGORY_LABEL[p.category]}</div></div>
          </button>
        ))}
        <span className="t-kicker t-sienna" style={{ marginTop: 6 }}>Library</span>
        {loading && !results.length ? <div className="skeleton" style={{ height: 56 }} /> : null}
        <InlineError error={error} />
        {results.map((r) => (
          <button key={r.catalogueId} type="button" className="product-row" onClick={() => onPick({ ref: { kind: "catalogue", catalogueId: r.catalogueId }, name: r.name, category: r.category })}>
            <ProductTile category={r.category} />
            <div className="grow"><div className="t-strong">{r.name}</div><div className="t-small t-muted">{r.brand} · {CATEGORY_LABEL[r.category]}</div></div>
            <RotaMarker icon="add" size={22} />
          </button>
        ))}
        {!loading && !results.length && !error ? <p className="t-note t-muted">No library match. Use the name as unknown, or scan the label.</p> : null}
        <div style={{ height: 4, background: COLOR.porcelain }} />
      </div>
    </Sheet>
  );
}
