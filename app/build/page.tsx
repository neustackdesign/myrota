"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { RotaMarker } from "@/components/brand/RotaMarker";
import { CATEGORY_LABEL, ProductTile } from "@/components/rota/parts";
import { PasteSheet, UnknownSheet } from "@/components/sheets/product";
import { BackButton, ErrorBlock, InlineError, LoadingBlock, useToast } from "@/components/ui/primitives";
import type { MixSubjectRef } from "@/lib/api/contract";
import { contextNeeds, draftForUnknown, draftFromCatalogue, PROBLEM_TEXT } from "@/lib/client/drafts";
import { useFlow, type BuildSource } from "@/lib/client/flow";
import { useRepository, useResource } from "@/lib/client/runtime";
import { isAnalysable } from "@/lib/domain/evidence";
import type { CatalogueProduct, ShelfProduct } from "@/lib/domain/types";
import { COLOR } from "@/lib/ui/ring";


function Builder() {
  const params = useSearchParams();
  const router = useRouter();
  const repo = useRepository();
  const toast = useToast();
  const { flow, update } = useFlow();
  const source = ((params.get("src") as BuildSource) ?? flow.source) || "organic";
  const shelf = useResource((r) => r.shelf());
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CatalogueProduct[]>([]);
  const [searchError, setSearchError] = useState<unknown>(null);
  const [searching, setSearching] = useState(false);
  const [searchTick, setSearchTick] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);
  const [sheet, setSheet] = useState<"paste" | "unknown" | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const carried = useRef(false);

  const products = useMemo(() => (shelf.data?.products ?? []).filter((p) => !p.finishedAt), [shelf.data]);

  useEffect(() => {
    let alive = true;
    setSearching(true);
    const t = setTimeout(() => {
      repo
        .searchCatalogue(query)
        .then((r) => alive && (setResults(r.results), setSearchError(null)))
        .catch((e) => alive && setSearchError(e))
        .finally(() => alive && setSearching(false));
    }, 180);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [query, repo, searchTick]);

  // Mix → builder: both checked products arrive pre-added, once.
  useEffect(() => {
    if (source !== "mix" || !flow.mixCarry || carried.current || !shelf.data) return;
    carried.current = true;
    const refs = [flow.mixCarry.a, flow.mixCarry.b];
    (async () => {
      for (const pick of refs) {
        const ref: MixSubjectRef = pick.ref;
        if (ref.kind === "shelf") continue;
        if (ref.kind === "catalogue") {
          const c = (await repo.searchCatalogue(pick.name)).results.find((x) => x.catalogueId === ref.catalogueId);
          if (c) await repo.addProduct(draftFromCatalogue(c));
        } else if (!shelf.data!.products.some((p) => p.name === ref.name)) {
          await repo.addProduct(draftForUnknown(ref.name, "none"));
        }
      }
      shelf.reload();
    })().catch(setActionError);
  }, [source, flow.mixCarry, shelf, repo]);

  const onShelf = (c: CatalogueProduct) => products.some((p) => p.identityKey && p.identityKey === c.identityKey);
  const add = async (c: CatalogueProduct) => {
    setBusy(c.catalogueId);
    setActionError(null);
    try {
      const res = await repo.addProduct(draftFromCatalogue(c));
      toast(res.duplicate ? "Already on your shelf" : `${c.name} added`);
      setQuery("");
      shelf.reload();
    } catch (e) {
      setActionError(e);
    } finally {
      setBusy(null);
    }
  };
  const remove = async (p: ShelfProduct) => {
    setBusy(p.id);
    try {
      await repo.removeProduct(p.id);
      shelf.reload();
    } catch (e) {
      setActionError(e);
    } finally {
      setBusy(null);
    }
  };

  const extract = async (method: "gallery" | "paste", payload: { file?: File; text?: string }) => {
    setBusy(method);
    setExtractError(null);
    setActionError(null);
    try {
      const res = await repo.extract({ method, side: "back", pastedText: payload.text }, payload.file);
      if (!res.ok) {
        setExtractError(PROBLEM_TEXT[res.problem]);
        return;
      }
      update({ draft: res.candidate, draftMethod: method, scanFor: source === "shelf" ? "shelf" : "add" });
      setSheet(null);
      router.push("/add/review");
    } catch (e) {
      setActionError(e);
    } finally {
      setBusy(null);
    }
  };

  const n = products.length;
  const q = query.trim();
  const exact = results.some((r) => r.name.toLowerCase() === q.toLowerCase());
  const label =
    source === "shelf" ? "Done" : n >= 3 || source === "invite" || source === "mix" ? "Build my rota" : n === 0 ? "Add a product to start" : `Build with ${n} product${n > 1 ? "s" : ""}`;
  const kicker = source === "invite" ? (flow.inviterName ? `Invited by ${flow.inviterName}` : "Invited") : source === "mix" ? "From Mix Check" : source === "shelf" ? "Shelf" : "Step 1 of 2";
  const sub =
    source === "invite"
      ? "One product is enough to start. Add more any time."
      : source === "shelf"
        ? "Your rota updates from tomorrow."
        : source === "mix"
          ? "Add anything else you use to round out the week."
          : "Three or more makes a proper week. Fewer works too.";

  const build = () => {
    if (source === "shelf") {
      router.push("/shelf");
      return;
    }
    const needs = contextNeeds(products);
    router.push(needs.care ? "/build/context" : "/build/progress");
  };

  return (
    <div className="app-frame">
      <main id="main" className="app-main" style={{ minHeight: "100dvh" }}>
        <div className="pad top-pad stack" style={{ paddingBottom: 12 }}>
          <div className="row">
            <BackButton fallback={source === "shelf" ? "/shelf" : "/"} />
            <span className="t-kicker t-sienna" style={{ marginLeft: "auto" }}>{kicker}</span>
          </div>
          <h1 className="t-display t-h1">{source === "shelf" ? "Add to your shelf" : "What's on your shelf?"}</h1>
          {source === "mix" && flow.mixCarry ? (
            <div className="row note note--lagoon" style={{ ["--gap" as string]: "10px" }}>
              <RotaMarker icon="mix" size={28} mode="colour" ink={COLOR.porcelain} paper={COLOR.lagoon} accent={COLOR.seaGlass} accent2={COLOR.apricot} />
              <span>
                From Mix Check: {flow.mixCarry.a.name} and {flow.mixCarry.b.name} · {flow.mixCarry.verdictLabel}.
              </span>
            </div>
          ) : null}
          <p className="t-body t-muted">{sub}</p>
          <div className="method-grid" role="group" aria-label="Ways to add a product">
            <button type="button" className="method method--primary" onClick={() => { update({ scanFor: source === "shelf" ? "shelf" : "add" }); router.push(`/add/scan?for=${source === "shelf" ? "shelf" : "add"}`); }}>
              <span className="scan-glyph" aria-hidden />Scan
            </button>
            <button type="button" className="method method--active" onClick={() => searchRef.current?.focus()}>
              <RotaMarker icon="add" size={24} />Search
            </button>
            <button type="button" className="method" onClick={() => setSheet("paste")}>
              <RotaMarker icon="log" size={24} />Paste
            </button>
            <button type="button" className="method" onClick={() => galleryRef.current?.click()} aria-busy={busy === "gallery" || undefined}>
              {busy === "gallery" ? <span className="spinner" aria-hidden style={{ width: 22, height: 22, borderRadius: "50%", border: "2px solid", borderRightColor: "transparent", animation: "spin 800ms linear infinite" }} /> : <RotaMarker icon="history" size={24} />}
              Gallery
            </button>
            <input
              ref={galleryRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void extract("gallery", { file });
              }}
            />
          </div>
          {extractError ? <p role="alert" className="note note--sienna" style={{ margin: 0 }}>{extractError}</p> : null}
          <label className="search">
            <span className="sr-only">Search brand or product</span>
            <input ref={searchRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search brand or product" enterKeyHint="search" />
          </label>
        </div>

        <div className="pad grow" style={{ paddingBottom: 16 }}>
          {q.length > 2 && !exact ? (
            <button type="button" className="unknown-add" style={{ margin: "4px 0 6px" }} onClick={() => setSheet("unknown")}>
              <ProductTile category="other" unknown />
              <div className="grow">
                <div className="t-strong">Add “{q}”</div>
                <div className="t-small t-muted">Not in our library. Scan the label, or add it as unknown.</div>
              </div>
            </button>
          ) : null}
          {searchError ? <ErrorBlock error={searchError} title="Search isn't working right now" onRetry={() => setSearchTick((t) => t + 1)} /> : null}
          {searching && !results.length ? <LoadingBlock lines={2} /> : null}
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }} aria-label="Library results">
            {results.map((r) => (
              <li key={r.catalogueId} className="product-row">
                <ProductTile category={r.category} />
                <div className="grow">
                  <div className="t-strong">{r.name}</div>
                  <div className="t-small t-muted">{r.brand} · {CATEGORY_LABEL[r.category]}</div>
                </div>
                {onShelf(r) ? (
                  <span className="tag tag--onshelf" style={{ fontSize: 12, padding: "4px 10px" }}>On shelf</span>
                ) : (
                  <button type="button" className="round-add" aria-label={`Add ${r.name}`} onClick={() => add(r)} disabled={busy === r.catalogueId}>
                    {busy === r.catalogueId ? <span className="spinner" aria-hidden style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid", borderRightColor: "transparent", animation: "spin 800ms linear infinite" }} /> : <RotaMarker icon="add" size={20} />}
                  </button>
                )}
              </li>
            ))}
          </ul>
          {!searching && !results.length && !searchError && q ? <p className="t-note t-muted">No library match for “{q}”.</p> : null}
        </div>

        <div className="pad" style={{ position: "sticky", bottom: 0, background: COLOR.porcelain, borderTop: `1px solid #EEF0EC`, padding: "12px 20px calc(16px + env(safe-area-inset-bottom))", display: "flex", flexDirection: "column", gap: 10 }}>
          {shelf.loading && !shelf.data ? <div className="skeleton" style={{ height: 36 }} /> : null}
          {shelf.error ? <ErrorBlock error={shelf.error} onRetry={shelf.reload} title="We couldn't load your shelf" /> : null}
          {n ? (
            <div className="row" style={{ overflowX: "auto", ["--gap" as string]: "6px", paddingBottom: 2 }} aria-label="On your shelf">
              {products.map((p) => (
                <button key={p.id} type="button" className={`chip chip--pick ${isAnalysable(p) ? "" : "chip--unknown"}`} onClick={() => remove(p)} aria-label={`Remove ${p.name}`} disabled={busy === p.id}>
                  <RotaMarker icon={isAnalysable(p) ? (p.category === "sunscreen" ? "spf" : p.category === "cleanser" ? "cleanser" : p.category === "moisturiser" ? "jar" : "serum") : "jar"} size={22} />
                  {p.name.length > 18 ? `${p.name.slice(0, 16)}…` : p.name}
                  <span className="x" aria-hidden>×</span>
                </button>
              ))}
            </div>
          ) : null}
          {source === "organic" ? (
            <div className="row">
              <div className="progress3" aria-hidden>
                {[0, 1, 2].map((i) => <span key={i} data-on={i < n} />)}
              </div>
              <span className="t-small t-muted">{n >= 3 ? "Good spread" : `${n} of 3 suggested`}</span>
            </div>
          ) : null}
          <InlineError error={actionError} />
          <button type="button" className="btn btn--primary btn--lg btn--block" disabled={source !== "shelf" && n === 0} onClick={build}>
            {label}
          </button>
        </div>
      </main>
      <PasteSheet open={sheet === "paste"} onClose={() => setSheet(null)} busy={busy === "paste"} error={actionError} onRead={(text) => extract("paste", { text })} />
      <UnknownSheet
        open={sheet === "unknown"}
        onClose={() => setSheet(null)}
        name={q}
        busy={busy === "unknown"}
        error={actionError}
        onAdd={async (placement) => {
          setBusy("unknown");
          setActionError(null);
          try {
            await repo.addProduct(draftForUnknown(q, placement));
            toast("Added as unknown");
            setSheet(null);
            setQuery("");
            shelf.reload();
          } catch (e) {
            setActionError(e);
          } finally {
            setBusy(null);
          }
        }}
      />
    </div>
  );
}

export default function BuildPage() {
  return (
    <Suspense fallback={null}>
      <Builder />
    </Suspense>
  );
}
