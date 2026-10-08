"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { RotaMarker } from "@/components/brand/RotaMarker";
import { BackButton, ErrorBlock, LoadingBlock } from "@/components/ui/primitives";
import { contextNeeds } from "@/lib/client/drafts";
import { readPrivateContext, writePrivateContext } from "@/lib/client/flow";
import { useResource } from "@/lib/client/runtime";
import type { CareAnswer, PlanContext, RetinoidExperience } from "@/lib/domain/types";

const RETINOID: [RetinoidExperience, string][] = [
  ["new", "No, new to it"],
  ["some", "Yes, for a few months"],
  ["long", "Yes, for over a year"],
];
const CARE: [CareAnswer, string][] = [
  ["pregnant_or_breastfeeding", "Pregnant or breastfeeding"],
  ["prescription_treatment", "Using a prescription skin treatment"],
  ["none", "None of these"],
  ["prefer_not_to_say", "Prefer not to say"],
];

export default function ContextPage() {
  const router = useRouter();
  const shelf = useResource((r) => r.shelf());
  const [ctx, setCtx] = useState<PlanContext>({});
  useEffect(() => {
    // Previous answers on THIS device only; never inferred, never from the server.
    const saved = readPrivateContext();
    if (saved) setCtx(saved);
  }, []);

  const needs = contextNeeds(shelf.data?.products ?? []);
  useEffect(() => {
    if (shelf.data && !needs.care) router.replace("/build/progress");
  }, [shelf.data, needs.care, router]);

  const ready = (!needs.retinoid || !!ctx.retinoidExperience) && !!ctx.care;
  const go = (c: PlanContext) => {
    writePrivateContext(c);
    router.push("/build/progress");
  };

  return (
    <div className="app-frame">
      <main id="main" className="app-main" style={{ minHeight: "100dvh" }}>
        <div className="pad top-pad stack grow" style={{ ["--gap" as string]: "18px", paddingBottom: 16 }}>
          <div className="row">
            <BackButton fallback="/build" />
            <span className="t-kicker t-muted" style={{ marginLeft: "auto" }}>{needs.retinoid ? "Two quick questions" : "One quick question"}</span>
          </div>
          {shelf.loading && !shelf.data ? <LoadingBlock lines={2} /> : null}
          {shelf.error ? <ErrorBlock error={shelf.error} onRetry={shelf.reload} /> : null}
          {needs.retinoid ? (
            <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0, ["--gap" as string]: "10px" }}>
              <legend className="t-display t-h2" style={{ fontSize: 24, marginBottom: 10 }}>Have you used a retinoid before?</legend>
              <span className="t-note t-muted">It sets how often your retinoid starts.</span>
              {RETINOID.map(([v, t]) => (
                <button key={v} type="button" className="option" aria-pressed={ctx.retinoidExperience === v} onClick={() => setCtx((c) => ({ ...c, retinoidExperience: v }))}>{t}</button>
              ))}
            </fieldset>
          ) : null}
          {needs.care ? (
            <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0, ["--gap" as string]: "10px" }}>
              <legend className="t-display t-h2" style={{ fontSize: 24, marginBottom: 10 }}>Anything we should plan around?</legend>
              <span className="t-note t-muted">Some treatments are best checked with a professional first. Only answer if you want to.</span>
              {CARE.map(([v, t]) => (
                <button key={v} type="button" className="option" aria-pressed={ctx.care === v} onClick={() => setCtx((c) => ({ ...c, care: v }))}>{t}</button>
              ))}
            </fieldset>
          ) : null}
          <div className="row note note--pearl" style={{ alignItems: "flex-start" }}>
            <RotaMarker icon="profile" size={24} />
            <span>Your answers stay on this phone. They never reach friends or anything you share, and aren't copied when you save your account.</span>
          </div>
        </div>
        <div className="pad stack" style={{ position: "sticky", bottom: 0, background: "#FBFAF6", borderTop: "1px solid #EEF0EC", padding: "12px 20px calc(16px + env(safe-area-inset-bottom))", ["--gap" as string]: "4px" }}>
          <button type="button" className="btn btn--primary btn--lg btn--block" disabled={!ready} onClick={() => go(ctx)}>Build my rota</button>
          <button type="button" className="btn btn--text btn--text-muted" onClick={() => go({ ...ctx, care: ctx.care ?? "prefer_not_to_say", retinoidExperience: ctx.retinoidExperience ?? (needs.retinoid ? "new" : null) })}>Skip for now</button>
        </div>
      </main>
    </div>
  );
}
