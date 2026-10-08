"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ToneRing } from "@/components/brand/RotaRing";
import { RotaMarker } from "@/components/brand/RotaMarker";
import { CATEGORY_LABEL, DAY_TYPE_LABEL, previewTones, ShelfCheck, shortDay } from "@/components/rota/parts";
import { ShareSheet } from "@/components/sheets/ShareSheet";
import { ErrorBlock, LoadingBlock } from "@/components/ui/primitives";
import { useFlow } from "@/lib/client/flow";
import { useResource } from "@/lib/client/runtime";
import { countDayTypes } from "@/lib/domain/scheduler";
import { weekdayOf } from "@/lib/domain/skincare-day";
import type { HeldProduct, RotaSnapshot, ShelfProduct } from "@/lib/domain/types";
import { COLOR } from "@/lib/ui/ring";

const HELD_TEXT: Record<HeldProduct["reason"], string> = {
  safety_flag: "has a safety note, so it stays on your shelf and out of this rota",
  context_hold: "is held because of your private answers. Check with a professional, then turn it on from Shelf",
  insufficient_evidence: "is waiting for a reviewed rule, so it isn't scheduled yet",
  not_analysable: "isn't analysed and you haven't placed it, so it stays on your shelf",
  finished: "is marked finished",
};

function revealNote(rota: RotaSnapshot, products: ShelfProduct[], mixNote: string | null, pairedWith: string | null): { text: string; tone: "lagoon" | "dew" | "sienna" } | null {
  const name = (id: string) => products.find((p) => p.id === id)?.name ?? "A product";
  if (mixNote) return { text: mixNote, tone: "lagoon" };
  const ctx = rota.held.find((h) => h.reason === "context_hold");
  if (ctx) return { text: `${name(ctx.productId)} ${HELD_TEXT.context_hold}.`, tone: "dew" };
  const placed = products.find((p) => p.inciStatus !== "verified" && p.inciStatus !== "user_confirmed" && p.placement && p.placement !== "none" && !p.finishedAt);
  if (placed) return { text: `${placed.name} is in your ${placed.placement === "am" ? "mornings" : "evenings"} because you put it there. We haven't analysed it.`, tone: "sienna" };
  if (pairedWith) return { text: `Built from your shelf only. ${pairedWith} has their own rota and can't see this one.`, tone: "dew" };
  return null;
}

export default function RevealPage() {
  const router = useRouter();
  const { flow } = useFlow();
  const rota = useResource((r) => r.currentRota());
  const shelf = useResource((r) => r.shelf());
  const [open, setOpen] = useState<number>(0);
  const [share, setShare] = useState(false);

  if ((rota.loading && !rota.data) || (shelf.loading && !shelf.data)) {
    return (
      <div className="app-frame"><main id="main" className="app-main pad top-pad"><LoadingBlock label="Loading your rota" /></main></div>
    );
  }
  if (rota.error || shelf.error || !rota.data) {
    return (
      <div className="app-frame">
        <main id="main" className="app-main pad top-pad stack">
          {rota.error || shelf.error ? (
            <ErrorBlock error={rota.error ?? shelf.error} onRetry={() => { rota.reload(); shelf.reload(); }} />
          ) : (
            <div className="state-block"><b>No rota yet</b><p className="t-note t-muted">Add what you own and we'll plan your week.</p><Link className="btn btn--primary btn--lg btn--block" href="/build">Add my products</Link></div>
          )}
        </main>
      </div>
    );
  }
  const r = rota.data.rota;
  const products = shelf.data?.products ?? [];
  const counts = countDayTypes(r);
  const note = revealNote(r, products, flow.mixNote, flow.pairedWith);
  const tones = previewTones(r);
  const sub = counts.treatment
    ? `${counts.treatment} treatment ${counts.treatment === 1 ? "day" : "days"} and ${counts.recovery + counts.rest} lighter ${counts.recovery + counts.rest === 1 ? "day" : "days"}. Mornings stay the same every day.`
    : counts.rest === 7
      ? "Nothing we can schedule yet. Add or scan a product to fill the week."
      : "The same calm plan every day. Add an active later and the week starts to vary.";

  return (
    <div className="app-frame">
      <main id="main" className="app-main" style={{ minHeight: "100dvh" }}>
        <section className="grain grain--sunrise stack center" style={{ padding: "calc(40px + env(safe-area-inset-top)) 22px 22px", ["--gap" as string]: "10px" }}>
          <span className="t-kicker">{r.weekNumber > 1 ? `Week ${r.weekNumber}` : flow.source === "invite" || flow.pairedWith ? "Your own rota" : "Your first rota"}</span>
          <div className="ring-disc" style={{ width: 172, height: 172, background: "transparent", boxShadow: "none" }} aria-hidden>
            <ToneRing tones={tones} size={168} strokeWidth={12} />
            <span className="t-display" style={{ fontSize: 24 }}>7 days</span>
          </div>
          <h1 className="t-display t-h1">Starts today, {weekdayOf(r.startDate)}.</h1>
          <p className="t-body" style={{ maxWidth: 320 }}>{sub}</p>
        </section>
        {note ? (
          <div className={`note ${note.tone === "lagoon" ? "note--lagoon" : note.tone === "sienna" ? "note--sienna" : "note--dew"}`} style={{ margin: "18px 20px 6px" }}>{note.text}</div>
        ) : null}
        <ol className="pad" style={{ listStyle: "none", margin: 0, paddingTop: 6 }} aria-label="Your seven days">
          {r.days.map((d, i) => {
            const isOpen = open === i;
            const recovery = d.type !== "treatment";
            return (
              <li key={d.skincareDate} style={{ borderBottom: "1px solid #EEF0EC" }}>
                <button type="button" onClick={() => setOpen(isOpen ? -1 : i)} aria-expanded={isOpen} className="row" style={{ width: "100%", padding: "11px 0", background: "none", border: 0, textAlign: "left", minHeight: 56 }}>
                  <span style={{ flex: "none", width: 38, height: 38, borderRadius: "50%", display: "grid", placeItems: "center", fontWeight: 600, fontSize: 12, background: recovery ? COLOR.dew : i === 0 ? COLOR.porcelain : COLOR.shell, border: `2px solid ${i === 0 ? COLOR.ember : recovery ? COLOR.seaGlass : COLOR.track}` }}>
                    {weekdayOf(d.skincareDate)[0]}
                  </span>
                  <div className="grow">
                    <div className="t-strong">{shortDay(d.skincareDate)} · {DAY_TYPE_LABEL[d.type]}{d.type === "treatment" ? ` · ${[...d.pm, ...d.am].find((s) => s.activeClass)?.displayName ?? ""}` : ""}</div>
                    <div className="t-small t-muted">Morning {d.am.length} · Evening {d.pm.length}{i === 0 ? " · today" : ""}</div>
                  </div>
                  <span className="t-strong t-sienna" style={{ fontSize: 13 }}>{isOpen ? "Hide" : "Show"}</span>
                </button>
                {isOpen ? (
                  d.am.length + d.pm.length === 0 ? (
                    <div className="note note--dew" style={{ marginBottom: 14 }}>Rest day. Nothing scheduled, one check-in.</div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, paddingBottom: 14 }}>
                      <div style={{ background: "#FCE6D8", borderRadius: 14, padding: "10px 12px" }}>
                        <div className="t-label t-sienna" style={{ fontSize: 11, marginBottom: 4 }}>Morning</div>
                        {d.am.length ? d.am.map((s, j) => <div key={j} className="t-small" style={{ lineHeight: 1.6 }}>{s.displayName}{s.analysed ? "" : " · not analysed"}</div>) : <div className="t-small t-muted">Nothing</div>}
                      </div>
                      <div style={{ background: COLOR.dusk, color: COLOR.porcelain, borderRadius: 14, padding: "10px 12px" }}>
                        <div className="t-label" style={{ fontSize: 11, marginBottom: 4, color: COLOR.seaGlass }}>Evening</div>
                        {d.pm.length ? d.pm.map((s, j) => <div key={j} className="t-small" style={{ lineHeight: 1.6 }}>{s.displayName}{s.analysed ? "" : " · not analysed"}</div>) : <div className="t-small" style={{ color: "#BFE4DD" }}>Nothing</div>}
                      </div>
                    </div>
                  )
                ) : null}
              </li>
            );
          })}
        </ol>
        <div className="pad" style={{ marginTop: 10 }}>
          <ShelfCheck items={r.shelfCheck} />
          {r.held.length ? (
            <details className="card card--line" style={{ marginTop: 10 }}>
              <summary className="t-strong" style={{ minHeight: 44, display: "flex", alignItems: "center", cursor: "pointer" }}>On your shelf, not in this rota · {r.held.length}</summary>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {r.held.map((h) => {
                  const p = products.find((x) => x.id === h.productId);
                  return <li key={h.productId} className="t-note" style={{ marginBottom: 6 }}>{p?.name ?? "A product"} ({p ? CATEGORY_LABEL[p.category] : ""}) {HELD_TEXT[h.reason]}.</li>;
                })}
              </ul>
            </details>
          ) : null}
        </div>
        <div className="pad row" style={{ justifyContent: "center", paddingTop: 6 }}>
          <button type="button" className="btn btn--text" onClick={() => setShare(true)}>
            <RotaMarker icon="share" size={20} />Share my rota
          </button>
        </div>
        <div style={{ position: "sticky", bottom: 0, padding: "18px 20px calc(20px + env(safe-area-inset-bottom))", background: "linear-gradient(rgba(251,250,246,0), #FBFAF6 35%)" }}>
          <button type="button" className="btn btn--primary btn--lg btn--block" onClick={() => router.push("/today?start=1")}>Start my streak</button>
        </div>
      </main>
      <ShareSheet
        key={share ? "open" : "closed"}
        open={share}
        onClose={() => setShare(false)}
        ringTones={tones}
        input={{ kind: "rota", treatmentDays: counts.treatment, recoveryDays: counts.recovery + counts.rest, productNames: products.filter((p) => r.productIds.includes(p.id) && !r.held.some((h) => h.productId === p.id)).map((p) => p.name) }}
      />
    </div>
  );
}
