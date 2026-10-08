"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { PhotoSlot } from "@/components/brand/PhotoSlot";
import { RotaRing } from "@/components/brand/RotaRing";
import { segmentsFor } from "@/components/rota/parts";
import { ShareSheet } from "@/components/sheets/ShareSheet";
import { Button, ErrorBlock, InlineError, LoadingBlock } from "@/components/ui/primitives";
import { newIdempotencyKey, useRepository, useResource } from "@/lib/client/runtime";
import { buildTodayView } from "@/lib/domain/today";
import type { Feeling } from "@/lib/domain/types";
import { REFLECTION_NOTE } from "@/lib/domain/week";
import { toPrototypeTones } from "@/lib/ui/ring";

const FEELINGS: [Feeling, string][] = [
  ["calm", "Calm"],
  ["bit_irritated", "A bit irritated"],
  ["very_irritated", "Very irritated"],
];

export default function WeekCompletePage() {
  const repo = useRepository();
  const today = useResource((r) => r.today());
  const [share, setShare] = useState(false);
  const [busy, setBusy] = useState<Feeling | null>(null);
  const [error, setError] = useState<unknown>(null);
  const keys = useRef(new Map<Feeling, string>());

  if (today.loading && !today.data) return <div className="app-frame"><main id="main" className="app-main pad top-pad"><LoadingBlock /></main></div>;
  if (today.error) return <div className="app-frame"><main id="main" className="app-main pad top-pad"><ErrorBlock error={today.error} onRetry={today.reload} /></main></div>;
  const d = today.data!;
  if (!d.rota) {
    return <div className="app-frame"><main id="main" className="app-main pad top-pad stack"><div className="state-block"><b>No rota yet</b><Link className="btn btn--primary btn--lg btn--block" href="/build">Add my products</Link></div></main></div>;
  }
  const view = buildTodayView({ rota: d.rota, rotas: d.rotas.length ? d.rotas : [d.rota], records: d.records, now: d.serverNow, timeZone: d.timeZone });
  const s = view.weekSummary;
  const segs = segmentsFor(view.week, -1);
  const full = s.outcome === "rota_complete";
  const reflection = d.rota.reflection;

  if (s.outcome === "in_progress") {
    return (
      <div className="app-frame"><main id="main" className="app-main pad top-pad stack">
        <div className="state-block"><b>This week is still going</b><p className="t-note t-muted">Day 7 closes at 4am after your last day. Your week summary appears then.</p><Link className="btn btn--primary btn--lg btn--block" href="/today">Back to today</Link></div>
      </main></div>
    );
  }

  const reflect = async (feeling: Feeling) => {
    setBusy(feeling);
    setError(null);
    try {
      if (!keys.current.has(feeling)) keys.current.set(feeling, newIdempotencyKey(`reflect:${d.rota!.id}:${feeling}`));
      const res = await repo.reflect(d.rota!.id, { feeling, idempotencyKey: keys.current.get(feeling)! });
      today.setData((prev) => ({ ...prev!, rota: res.rota, rotas: prev!.rotas.map((r) => (r.id === res.rota.id ? res.rota : r)) }));
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="app-frame app-frame--pearl">
      <main id="main" className="app-main" style={{ minHeight: "100dvh" }}>
        <section className={`grain ${full ? "grain--sunrise" : "grain--rinse"}`} style={{ position: "relative", padding: "calc(40px + env(safe-area-inset-top)) 16px 0", height: full ? 360 : 220 }}>
          {full ? <PhotoSlot asset="milestone" style={{ height: "100%", width: "100%" }} /> : null}
          <div className="ring-disc" style={{ position: "absolute", right: 26, bottom: -56, width: 132, height: 132, boxShadow: "0 0 0 2px #2A1911", zIndex: 2 }} role="img" aria-label={`${view.streak.continuity}-day streak`}>
            <RotaRing segments={segs} size={120} strokeWidth={12} />
            <div className="ring-centre">
              <div className="ring-num" style={{ fontSize: 40 }}>{view.streak.continuity}</div>
              <div className="ring-label">day streak</div>
            </div>
          </div>
        </section>
        <div className="pad stack" style={{ padding: "20px 20px calc(28px + env(safe-area-inset-bottom))", ["--gap" as string]: "14px" }}>
          <span className="t-kicker t-muted">Week {d.rota.weekNumber} · {s.followed} of 7 followed</span>
          <h1 className="t-display" style={{ fontSize: 38, maxWidth: 220 }}>{full ? "Rota complete." : "Week ended."}</h1>
          <p className="t-body">
            {full
              ? "Seven days followed. Recovery and rest days counted like any other."
              : `${s.earned} of 7 days done${s.rescued ? `, ${s.rescued} rescued` : ""}. Next week starts fresh from the same shelf, with a new Rescue.`}
          </p>
          <section className="card stack" aria-labelledby="reflect-q" style={{ ["--gap" as string]: "10px" }}>
            <h2 id="reflect-q" className="t-strong" style={{ fontSize: 16, margin: 0 }}>How did your skin feel this week?</h2>
            <span className="t-small t-muted">Optional. Saved with this week's rota.</span>
            {FEELINGS.map(([v, t]) => (
              <button key={v} type="button" className="option" aria-pressed={reflection?.feeling === v} onClick={() => reflect(v)} disabled={!!busy}>
                {t}
                {busy === v ? <span className="spinner" aria-hidden style={{ marginLeft: "auto", width: 16, height: 16, borderRadius: "50%", border: "2px solid", borderRightColor: "transparent", animation: "spin 800ms linear infinite" }} /> : null}
                {reflection?.feeling === v && busy !== v ? <span className="t-small t-ink-link" style={{ marginLeft: "auto" }}>Saved</span> : null}
              </button>
            ))}
            {reflection ? <p className="note note--dew" role="status">{REFLECTION_NOTE[reflection.feeling]}</p> : null}
            <InlineError error={error} />
          </section>
          <Link className="btn btn--primary btn--lg btn--block" href="/week/next">Plan next week</Link>
          {full ? <Button icon="share" onClick={() => setShare(true)}>Share my week</Button> : null}
        </div>
      </main>
      <ShareSheet key={share ? "o" : "c"} open={share} onClose={() => setShare(false)} ringTones={toPrototypeTones(segs).map((t) => (t === "x" ? "#E8D8C9" : t))} input={{ kind: "day7", streak: view.streak.continuity, earned: s.earned }} />
    </div>
  );
}
