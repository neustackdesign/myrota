"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { RotaMarker } from "@/components/brand/RotaMarker";
import { CATEGORY_LABEL, ProductTile } from "@/components/rota/parts";
import { Button, ErrorBlock, InlineError, LoadingBlock, useToast } from "@/components/ui/primitives";
import { readPrivateContext, useFlow } from "@/lib/client/flow";
import { newIdempotencyKey, useRepository, useResource } from "@/lib/client/runtime";
import { isAnalysable } from "@/lib/domain/evidence";

export default function NextWeekPage() {
  const router = useRouter();
  const repo = useRepository();
  const toast = useToast();
  const { update } = useFlow();
  const shelf = useResource((r) => r.shelf());
  const rota = useResource((r) => r.currentRota());
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const key = useRef(newIdempotencyKey("next-week"));
  const next = (rota.data?.rota.weekNumber ?? 1) + 1;

  return (
    <div className="app-frame">
      <main id="main" className="app-main" style={{ minHeight: "100dvh" }}>
        <div className="grain grain--rinse pad top-pad stack" style={{ paddingBottom: 18, ["--gap" as string]: "10px" }}>
          <span className="t-kicker t-muted">Week {next}</span>
          <h1 className="t-display t-h1">Fresh week. Same shelf.</h1>
          <p className="t-body t-muted">Mark anything you've finished. Add anything new. Nothing gets stronger automatically.</p>
        </div>
        <div className="pad grow stack" style={{ ["--gap" as string]: "0px", paddingBottom: 16 }}>
          {shelf.loading && !shelf.data ? <LoadingBlock lines={3} /> : null}
          {shelf.error ? <ErrorBlock error={shelf.error} onRetry={shelf.reload} /> : null}
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {(shelf.data?.products ?? []).map((p) => {
              const f = !!p.finishedAt;
              return (
                <li key={p.id} className="product-row">
                  <span style={{ opacity: f ? 0.5 : 1 }}><ProductTile category={p.category} unknown={!isAnalysable(p)} /></span>
                  <div className="grow" style={{ opacity: f ? 0.5 : 1 }}>
                    <div className="t-strong" style={{ textDecoration: f ? "line-through" : "none" }}>{p.name}</div>
                    <div className="t-small t-muted">{f ? "Finished · left out of next week" : [p.brand, CATEGORY_LABEL[p.category]].filter(Boolean).join(" · ")}</div>
                  </div>
                  <button
                    type="button"
                    className="btn"
                    aria-pressed={f}
                    disabled={busy === p.id}
                    onClick={async () => {
                      setBusy(p.id);
                      setError(null);
                      try {
                        const updated = await repo.patchProduct(p.id, { finished: !f });
                        shelf.setData((s) => ({ products: (s?.products ?? []).map((x) => (x.id === p.id ? updated : x)) }));
                      } catch (e) {
                        setError(e);
                      } finally {
                        setBusy(null);
                      }
                    }}
                  >
                    {f ? "Undo" : "Finished"}
                  </button>
                </li>
              );
            })}
          </ul>
          <Link className="btn btn--lg btn--block" style={{ marginTop: 14 }} href="/build?src=shelf" onClick={() => update({ source: "shelf" })}><RotaMarker icon="add" size={22} />Add a product</Link>
        </div>
        <div className="pad stack" style={{ position: "sticky", bottom: 0, background: "#FBFAF6", borderTop: "1px solid #EEF0EC", padding: "12px 20px calc(16px + env(safe-area-inset-bottom))" }}>
          <InlineError error={error} />
          <Button
            variant="primary"
            busy={busy === "start"}
            onClick={async () => {
              setBusy("start");
              setError(null);
              try {
                await repo.nextRota({ idempotencyKey: key.current, context: readPrivateContext() ?? {} });
                toast(`Week ${next} is ready`);
                router.replace("/today");
              } catch (e) {
                setError(e);
              } finally {
                setBusy(null);
              }
            }}
          >
            Start week {next}
          </Button>
        </div>
      </main>
    </div>
  );
}
