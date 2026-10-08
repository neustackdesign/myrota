"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CATEGORY_ICON } from "@/components/rota/parts";
import { RotaMarker } from "@/components/brand/RotaMarker";
import { ShareSheet } from "@/components/sheets/ShareSheet";
import { BackButton, ErrorBlock, LoadingBlock } from "@/components/ui/primitives";
import { useFlow } from "@/lib/client/flow";
import { useRepository, useResource } from "@/lib/client/runtime";
import { VERDICT_LABEL, VERDICT_LINE, verdictTone } from "@/lib/domain/mix";
import { ACTIVE_CLASS_LABEL } from "@/lib/domain/share";
import type { ProductCategory } from "@/lib/domain/types";
import { COLOR } from "@/lib/ui/ring";

export default function MixResultPage() {
  const router = useRouter();
  const { flow, update } = useFlow();
  const repo = useRepository();
  const [share, setShare] = useState(false);
  const a = flow.mixA;
  const b = flow.mixB;
  const mix = useResource((r) => (a && b ? r.mix({ a: a.ref, b: b.ref }) : Promise.resolve(null)), [a?.name, b?.name]);

  if (!a || !b) {
    return (
      <div className="app-frame">
        <main id="main" className="app-main pad top-pad stack">
          <div className="state-block">
            <b>Pick two products first</b>
            <p className="t-note t-muted">Mix Check compares two products. Nothing is saved.</p>
            <Link className="btn btn--primary btn--lg btn--block" href="/mix">Choose products</Link>
          </div>
        </main>
      </div>
    );
  }
  const res = mix.data?.result;
  const tone = res ? verdictTone(res.verdict) : "lagoon";
  const hdr = tone === "lagoon" ? COLOR.lagoon : COLOR.sienna;

  return (
    <div className="app-frame">
      <main id="main" className="app-main" style={{ minHeight: "100dvh" }}>
        <section className="on-dark" style={{ background: hdr, color: COLOR.porcelain, padding: "calc(20px + env(safe-area-inset-top)) 20px 22px", display: "flex", flexDirection: "column", gap: 12 }} aria-live="polite">
          <div className="row">
            <BackButton onDark fallback="/mix" />
            <span className="t-kicker" style={{ marginLeft: "auto" }}>Mix Check</span>
          </div>
          <div className="row" style={{ ["--gap" as string]: "10px" }} aria-hidden>
            {[a, b].map((p, i) => (
              <span key={i} style={{ display: "contents" }}>
                {i === 1 ? <span className="t-display" style={{ fontSize: 26 }}>+</span> : null}
                <span style={{ width: 56, height: 56, borderRadius: 16, background: COLOR.porcelain, display: "grid", placeItems: "center" }}>
                  <RotaMarker icon={p.ref.kind === "unknown" ? "jar" : CATEGORY_ICON[(p.category as ProductCategory) ?? "other"] ?? "jar"} size={36} />
                </span>
              </span>
            ))}
          </div>
          <span className="t-strong">{a.name} + {b.name}</span>
          {mix.loading && !res ? <div className="skeleton" style={{ height: 70, opacity: 0.5 }} /> : null}
          {res ? (
            <>
              <h1 className="t-display" style={{ fontSize: 36, lineHeight: 1 }}>{VERDICT_LABEL[res.verdict]}</h1>
              <p className="t-lede">{VERDICT_LINE[res.verdict]}</p>
              {repo.mode === "demo" && res.basis === "reviewed_rule" ? (
                <p className="plate t-small" style={{ margin: 0, color: COLOR.ebony }}>Demo fixture rule, not a reviewed verdict. Production shows a verdict only from pharmacist-reviewed rules.</p>
              ) : null}
              {res.activeClasses.some((c) => c.length) ? (
                <p className="t-small" style={{ margin: 0, opacity: 0.9 }}>
                  Confirmed actives: {res.activeClasses.map((c) => (c.length ? c.map((x) => ACTIVE_CLASS_LABEL[x]).join(" + ") : "not confirmed")).join(" · ")}
                </p>
              ) : null}
            </>
          ) : null}
        </section>
        <div className="pad stack" style={{ paddingTop: 18, paddingBottom: "calc(24px + env(safe-area-inset-bottom))", ["--gap" as string]: "10px" }}>
          {mix.error ? <ErrorBlock error={mix.error} onRetry={mix.reload} title="We couldn't check this pair" /> : null}
          {mix.loading && !res ? <LoadingBlock lines={2} label="Checking the pair" /> : null}
          {res ? (
            <>
              <span className="t-kicker t-muted">Why</span>
              <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                {res.reasons.slice(0, 3).map((o, i) => (
                  <li key={i} className="obs">
                    <span className={`obs__dot ${res.basis === "unknown_product" || res.basis === "unreviewed_pair" ? "obs__dot--unknown" : ""}`}>{i + 1}</span>
                    <div><div className="t-strong">{o.heading}</div><div className="t-note t-muted" style={{ marginTop: 2 }}>{o.body}</div></div>
                  </li>
                ))}
              </ol>
              <p className="t-small t-muted">
                {res.basis === "reviewed_rule" ? `Rule set ${res.ruleSetVersion} · ${res.ruleIds.join(", ")}` : "No reviewed rule covers this pair, so we don't call it compatible."}
              </p>
              <button
                type="button"
                className="btn btn--primary btn--lg btn--block"
                style={{ marginTop: 8 }}
                onClick={() => {
                  update({ source: "mix", mixCarry: { a, b, verdictLabel: VERDICT_LABEL[res.verdict], firstReason: res.reasons[0]?.heading ?? null } });
                  router.push("/build?src=mix");
                }}
              >
                Build a 7-day rota with these
              </button>
              <button type="button" className="btn btn--lg btn--block" onClick={() => setShare(true)}><RotaMarker icon="share" size={22} />Share this answer</button>
              <button type="button" className="btn btn--text" onClick={() => { update({ mixA: null, mixB: null }); router.push("/mix"); }}>Check another pair</button>
            </>
          ) : null}
        </div>
      </main>
      {res ? (
        <ShareSheet key={share ? "o" : "c"} open={share} onClose={() => setShare(false)} input={{ kind: "mix", result: res, verdictLabel: VERDICT_LABEL[res.verdict], productNames: [a.name, b.name] }} />
      ) : null}
    </div>
  );
}
