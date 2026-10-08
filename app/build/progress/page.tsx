"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { RotaRing } from "@/components/brand/RotaRing";
import { Button } from "@/components/ui/primitives";
import { apiErrorMessage } from "@/lib/api/repository";
import { readPrivateContext, useFlow } from "@/lib/client/flow";
import { newIdempotencyKey, useRepository } from "@/lib/client/runtime";
import { COLOR } from "@/lib/ui/ring";

/** Building: segments fill 0→7 at 260ms while the server builds the rota. Advances only on a real result. */
export default function BuildingPage() {
  const router = useRouter();
  const repo = useRepository();
  const { flow, update } = useFlow();
  const [n, setN] = useState(0);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  const key = useRef(newIdempotencyKey("rota"));
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    const id = setInterval(() => setN((x) => (x >= 7 ? 7 : x + 1)), 260);
    return () => clearInterval(id);
  }, [attempt]);

  useEffect(() => {
    let alive = true;
    setError(null);
    (async () => {
      const shelf = await repo.shelf();
      if (alive) setCount(shelf.products.filter((p) => !p.finishedAt).length);
      const res = await repo.createRota({
        context: readPrivateContext() ?? {},
        idempotencyKey: key.current,
        mixPair: flow.source === "mix" && flow.mixCarry ? { a: flow.mixCarry.a.ref, b: flow.mixCarry.b.ref } : null,
      });
      let pairedWith: string | null = null;
      if (flow.inviteToken) {
        const acc = await repo.acceptInvite(flow.inviteToken);
        pairedWith = acc.friend.displayName;
      }
      if (!alive) return;
      update({ mixNote: res.mixNote ?? null, pairedWith, inviteToken: null });
      setDone(true);
    })().catch((e) => alive && setError(e));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, repo]);

  useEffect(() => {
    if (done && n >= 7) {
      const t = setTimeout(() => router.replace("/rota"), 400);
      return () => clearTimeout(t);
    }
  }, [done, n, router]);

  const lines: [string, number][] = [
    [count == null ? "Reading your shelf" : `Reading ${count} product${count === 1 ? "" : "s"}`, 1],
    ["Checking what we can confirm", 3],
    ["Giving strong products their own days", 5],
  ];

  return (
    <div className="app-frame app-frame--lagoon">
      <main id="main" className="app-main grain grain--lagoon on-dark" style={{ minHeight: "100dvh", alignItems: "center", justifyContent: "center", gap: 28, padding: 24, textAlign: "center" }}>
        <div style={{ display: "grid", placeItems: "center" }} aria-hidden>
          <div style={{ gridArea: "1/1" }}>
            <RotaRing segments={[]} size={180} strokeWidth={12} mono={{ color: COLOR.porcelain, filled: error ? n : n, trackOpacity: 0.22 }} />
          </div>
          <span className="t-display" style={{ gridArea: "1/1", fontSize: 40 }}>{n}</span>
        </div>
        <h1 className="t-display" style={{ fontSize: 28 }}>{error ? "We couldn't build it yet" : "Building your rota"}</h1>
        <div role="status" aria-live="polite" className="stack" style={{ ["--gap" as string]: "8px", minHeight: 80, fontSize: 14 }}>
          {error ? (
            <>
              <p className="t-body" style={{ maxWidth: 300 }}>{apiErrorMessage(error)}</p>
              <div style={{ background: COLOR.porcelain, borderRadius: 999 }}>
                <Button variant="secondary" onClick={() => { setN(0); setAttempt((a) => a + 1); }}>Try again</Button>
              </div>
            </>
          ) : (
            lines.map(([t, at]) => (
              <span key={t} style={{ opacity: n >= at ? 1 : 0.15, transition: "opacity 300ms" }}>{t}</span>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
