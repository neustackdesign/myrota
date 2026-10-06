"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SEED_PRODUCTS, getProducts } from "@/lib/domain/catalogue";
import { generateRota } from "@/lib/domain/generate-rota";
import type { RoutineContext } from "@/lib/domain/types";
import { loadState, saveState } from "@/lib/client/storage";

export default function BuildPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [context, setContext] = useState<RoutineContext>({});

  useEffect(() => {
    const existing = loadState();
    setSelected(existing.selectedProductIds);
    setContext(existing.context);
  }, []);

  const selectedProducts = useMemo(() => getProducts(selected), [selected]);
  const hasRetinoid = selectedProducts.some((product) =>
    product.activeClasses.includes("retinoid"),
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return SEED_PRODUCTS;
    return SEED_PRODUCTS.filter((product) =>
      `${product.brand} ${product.name}`.toLowerCase().includes(needle),
    );
  }, [query]);

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  function buildRota() {
    if (!selected.length) return;
    const rota = generateRota(selected, context);
    const previous = loadState();

    saveState({
      ...previous,
      selectedProductIds: selected,
      context,
      rota,
      completions: {},
      rescuedDayIndex: undefined,
    });

    router.push("/routine");
  }

  return (
    <main className="shell">
      <header className="topbar">
        <Link className="brand" href="/">myrota</Link>
        <span className="pill">{selected.length} on shelf</span>
      </header>

      <section className="section">
        <div className="eyebrow">Build your first rota</div>
        <h1 style={{ fontSize: "clamp(40px, 9vw, 66px)" }}>
          What are you using?
        </h1>
        <p className="lede">
          Three or more gives us a better picture. If you arrived from a
          friend, one is enough to start.
        </p>
        <input
          className="input"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search the test catalogue"
          aria-label="Search products"
        />
      </section>

      <section className="product-list">
        {filtered.map((product) => {
          const isSelected = selected.includes(product.id);
          return (
            <button
              className={`product-row ${isSelected ? "selected" : ""}`}
              key={product.id}
              type="button"
              onClick={() => toggle(product.id)}
            >
              <span className="check">{isSelected ? "✓" : ""}</span>
              <span className="product-copy">
                <strong>{product.name}</strong>
                <span>
                  {product.brand} · {product.format === "rinse_off" ? "Rinse-off" : "Leave-on"}
                </span>
              </span>
            </button>
          );
        })}
      </section>

      {hasRetinoid ? (
        <section className="section card">
          <h3>Are you new to retinoids?</h3>
          <p className="muted">
            This changes how many retinoid nights appear in your first week.
          </p>
          <div className="actions">
            <button
              type="button"
              className={`button ${context.retinoidExperience === "new" ? "lime" : "secondary"}`}
              onClick={() => setContext({ ...context, retinoidExperience: "new" })}
            >
              Yes, new to it
            </button>
            <button
              type="button"
              className={`button ${context.retinoidExperience === "regular" ? "lime" : "secondary"}`}
              onClick={() => setContext({ ...context, retinoidExperience: "regular" })}
            >
              I use one regularly
            </button>
          </div>
        </section>
      ) : null}

      <div className="sticky-action">
        <button
          className="button lime"
          type="button"
          disabled={!selected.length || (hasRetinoid && !context.retinoidExperience)}
          onClick={buildRota}
        >
          {selected.length >= 3
            ? "Build my 7-day rota →"
            : selected.length
              ? "Build a basic rota →"
              : "Add a product to start"}
        </button>
      </div>

      <p className="footer-note">
        This first build uses a deliberately small test catalogue. Search,
        ingredient-photo capture and verified local catalogue coverage are the
        next ingestion layer.
      </p>
    </main>
  );
}
