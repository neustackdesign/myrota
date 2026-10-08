"use client";

import { notFound } from "next/navigation";
import { PhotoSlot } from "@/components/brand/PhotoSlot";
import { RotaMarker, type MarkerName } from "@/components/brand/RotaMarker";
import { RotaRing } from "@/components/brand/RotaRing";
import { Wordmark } from "@/components/brand/Wordmark";
import { SafetyFlagCard } from "@/components/rota/parts";
import { ShareCardVisual } from "@/components/sheets/ShareSheet";
import { DEMO_MODE } from "@/lib/client/runtime";
import { VERDICT_LABEL, VERDICT_LINE, verdictTone } from "@/lib/domain/mix";
import { buildShareCard, type ShareFormat, type ShareInput } from "@/lib/domain/share";
import type { MixVerdict } from "@/lib/domain/types";
import { COLOR, DONE_TONES, segmentFor } from "@/lib/ui/ring";

/** DEMO-only state gallery (Storybook-style) for screenshot parity. 404 in production builds. */
const ICONS: MarkerName[] = ["am", "pm", "done", "rota", "log", "history", "share", "settings", "shelf", "cleanser", "serum", "jar", "spf", "water", "friends", "mix", "rescue", "reminder", "add", "profile"];
const VERDICTS: MixVerdict[] = ["fine_together", "better_separated", "alternate_days", "professional_check", "insufficient_evidence"];

const fixtures: typeof import("@/lib/demo/fixtures") | null =
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  process.env.NEXT_PUBLIC_MYROTA_DEMO === "1" ? require("@/lib/demo/fixtures") : null;

export default function StatesPage() {
  if (!DEMO_MODE || !fixtures) notFound();
  const { DEMO_ALERT_FLAG, DEMO_LABEL_FLAG } = fixtures;
  const ringStates = [
    { cap: "Day 1, nothing done", segs: Array.from({ length: 7 }, (_, i) => segmentFor(i, i === 0 ? "in_progress" : "future", "treatment", i === 0)), n: 0, l: "day streak" },
    { cap: "Mid-rota, recovery kept", segs: [segmentFor(0, "complete", "treatment", false), segmentFor(1, "complete", "recovery", false), segmentFor(2, "complete", "treatment", false), segmentFor(3, "in_progress", "recovery", true), ...[4, 5, 6].map((i) => segmentFor(i, "future", i % 2 ? "recovery" : "treatment", false))], n: 14, l: "day streak" },
    { cap: "Yesterday missed · at risk", segs: [segmentFor(0, "complete", "treatment", false), segmentFor(1, "complete", "recovery", false), segmentFor(2, "missed", "treatment", false), segmentFor(3, "in_progress", "recovery", true), ...[4, 5, 6].map((i) => segmentFor(i, "future", "treatment", false))], n: 13, l: "at risk" },
    { cap: "Rescued · continuity kept", segs: [segmentFor(0, "complete", "treatment", false), segmentFor(1, "complete", "recovery", false), segmentFor(2, "rescued", "treatment", false), segmentFor(3, "complete", "recovery", true), ...[4, 5, 6].map((i) => segmentFor(i, "future", "treatment", false))], n: 15, l: "day streak" },
    { cap: "Rota complete 7/7", segs: Array.from({ length: 7 }, (_, i) => segmentFor(i, "complete", i % 2 ? "recovery" : "treatment", false)), n: 21, l: "day streak" },
  ];
  const dots: [string, string][] = [["dot dot--done", "Done"], ["dot dot--recovery", "Recovery done"], ["dot dot--rescued", "Rescued"], ["dot dot--today", "Today"], ["dot dot--missed", "Missed"], ["dot", "Future"], ["dot dot--future-recovery", "Future recovery"]];
  const shareInputs: ShareInput[] = [
    { kind: "rota", treatmentDays: 3, recoveryDays: 4, productNames: ["Cleanser", "Retinal"] },
    { kind: "mix", result: { verdict: "alternate_days", activeClasses: [["retinoid"], ["bha"]] }, verdictLabel: "Alternate days", productNames: ["Retinal", "BHA"] },
    { kind: "mix", result: { verdict: "insufficient_evidence", activeClasses: [["retinoid"], []] }, verdictLabel: "Not enough evidence", productNames: ["Retinal", "Shea butter"] },
    { kind: "day3", streak: 3 },
    { kind: "day7", streak: 7, earned: 7 },
    { kind: "friend", pairStreak: 12, myName: "Kemi", friendName: "Ama", inviteToken: null },
  ];
  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "32px 20px 80px", background: COLOR.pearl }}>
      <main id="main" className="stack" style={{ ["--gap" as string]: "40px" }}>
        <header className="stack"><Wordmark size={48} /><h1 className="t-display" style={{ fontSize: 40 }}>Component states · v1.2 implementation</h1><p className="t-body t-muted">Demo-only gallery. Marker icons, Grain and Wordmark are provisional re-draws pending the Brand v4 source files.</p></header>

        <section className="stack"><h2 className="t-kicker">Rota Ring + streak centre</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 16 }}>
            {ringStates.map((r) => (
              <figure key={r.cap} className="stack center" style={{ margin: 0 }}>
                <div className="ring-disc" style={{ width: 146, height: 146 }}><RotaRing segments={r.segs} size={134} /><div className="ring-centre"><div className="ring-num" style={{ fontSize: 40 }}>{r.n}</div><div className="ring-label">{r.l}</div></div></div>
                <figcaption className="t-small t-muted">{r.cap}</figcaption>
              </figure>
            ))}
          </div>
          <div className="dot-legend">{dots.map(([c, t]) => <div key={t} className="row"><span className={c} style={{ ["--d" as string]: DONE_TONES[0] }} /><span className="t-small">{t}</span></div>)}</div>
        </section>

        <section className="stack"><h2 className="t-kicker">Buttons</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
            <button className="btn btn--primary btn--lg btn--block">Primary · Ember</button>
            <button className="btn btn--primary btn--lg btn--block" disabled>Disabled · 40%</button>
            <button className="btn btn--rescue btn--lg btn--block">Rescue · Sea glass</button>
            <button className="btn btn--lg btn--block">Secondary</button>
            <button className="btn">Compact</button>
            <button className="btn btn--text">Text · Sea glass ink</button>
          </div>
        </section>

        <section className="stack"><h2 className="t-kicker">Ingredient chips · provenance badges</h2>
          <div className="chip-row">
            <span className="chip">Glycerin</span><span className="chip chip--active">Retinal</span><span className="chip chip--flag">Hydroquinone 2%</span><span className="chip chip--unreadable">unreadable</span><span className="chip chip--corrected">Niacinamide · edited</span><span className="chip chip--unknown">Shea butter</span>
          </div>
          <div className="chip-row"><span className="badge badge--good">Ingredients · verified</span><span className="badge badge--mid">Ingredients · you corrected, awaiting confirmation</span><span className="badge badge--low">Ingredients · partly read</span><span className="badge badge--low">Name · not read</span></div>
        </section>

        <section className="stack"><h2 className="t-kicker">SafetyFlag · label-declared vs independent alert</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12 }}>
            <SafetyFlagCard flag={DEMO_LABEL_FLAG} demo /><SafetyFlagCard flag={DEMO_ALERT_FLAG} demo />
          </div>
        </section>

        <section className="stack"><h2 className="t-kicker">Mix verdicts (5)</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
            {VERDICTS.map((v) => (
              <div key={v} style={{ background: verdictTone(v) === "lagoon" ? COLOR.lagoon : COLOR.sienna, color: COLOR.porcelain, borderRadius: 22, padding: 18 }}>
                <div className="t-kicker">Mix Check</div><div className="t-display" style={{ fontSize: 28, marginTop: 6 }}>{VERDICT_LABEL[v]}</div><p className="t-note" style={{ marginTop: 6 }}>{VERDICT_LINE[v]}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="stack"><h2 className="t-kicker">Share cards · 9:16 · square · link preview (names off by default)</h2>
          {(["story", "square", "og"] as ShareFormat[]).map((f) => (
            <div key={f} className="row" style={{ flexWrap: "wrap", alignItems: "flex-start", ["--gap" as string]: "14px" }}>
              {shareInputs.map((s, i) => <ShareCardVisual key={i} card={buildShareCard(s, { format: f })} ringTones={DONE_TONES} />)}
            </div>
          ))}
        </section>

        <section className="stack"><h2 className="t-kicker">Marker icons (provisional) · mono and colour</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(84px, 1fr))", gap: 16 }}>
            {ICONS.map((n) => <div key={n} className="stack center" style={{ ["--gap" as string]: "6px" }}><RotaMarker icon={n} size={48} /><RotaMarker icon={n} size={32} mode="colour" /><span className="t-small t-sienna">{n}</span></div>)}
          </div>
        </section>

        <section className="stack"><h2 className="t-kicker">Grain fields (approximation) · photo slots (missing licensed assets)</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
            {["sunrise", "dusk", "evening", "skin", "sea", "tide", "rinse", "streak", "lagoon"].map((g) => <div key={g} className={`grain grain--${g}`} style={{ aspectRatio: "4/3", borderRadius: 22, display: "flex", alignItems: "flex-end", padding: 12 }}><span className="plate t-small">{g}</span></div>)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
            <PhotoSlot asset="landingHero" /><PhotoSlot asset="inviteHero" /><PhotoSlot asset="milestone" />
          </div>
        </section>
      </main>
    </div>
  );
}
