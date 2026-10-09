"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useReducer, useState } from "react";
import { AppFrame } from "@/components/app/AppFrame";

/**
 * Drives the generated v1.6 screens with the verbatim prototype logic
 * (fixtures, simulated timing). Query: ?j=<journey 0-6>&s=<step> renders one
 * state for screenshot parity. Loaded only in DEMO builds.
 */
export function StatesGallery() {
  const [logic, setLogic] = useState<any>(null);
  const [demo, setDemo] = useState<any>(null);
  const [, force] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_MYROTA_DEMO !== "1") return;
    let unsub: (() => void) | undefined;
    import("@/components/app/screens-demo").then((m) => setDemo(m));
    import("@/lib/demo/prototype-logic").then(({ PrototypeLogic }) => {
      const L: any = new PrototypeLogic({});
      const q = new URLSearchParams(window.location.search);
      const j = Number(q.get("j") ?? 0), s = Number(q.get("s") ?? 0);
      L.apply(j, s);
      unsub = L.subscribe(() => { L.syncStreak?.(); force(); });
      setLogic(L);
    });
    return () => unsub?.();
  }, []);
  const v = useMemo(() => (logic ? logic.renderVals() : null), [logic, logic?.state]);
  if (!logic || !v) return <p style={{ padding: 24 }}>Loading demo states…</p>;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 24, padding: 24, alignItems: "flex-start", justifyContent: "center", background: "#F1E0D2", minHeight: "100vh" }}>
      <aside style={{ flex: "0 1 320px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", background: "#2A1911", color: "#FBFAF6", padding: "8px 12px", borderRadius: 999, alignSelf: "flex-start" }}>Demo data · design review only</div>
        {v.journeys.map((j: any, ji: number) => (
          <details key={j.n} open={logic.state.journey === ji} style={{ background: "#FBFAF6", borderRadius: 16, padding: "10px 14px" }}>
            <summary style={{ fontWeight: 600, cursor: "pointer" }}>{j.n} {j.title}</summary>
            <ol style={{ margin: "8px 0 0", paddingLeft: 20, display: "flex", flexDirection: "column", gap: 4 }}>
              {logic.J()[ji].steps.map((st: any, si: number) => (
                <li key={si}>
                  <a href={`?j=${ji}&s=${si}`} onClick={(e) => { e.preventDefault(); history.replaceState(null, "", `?j=${ji}&s=${si}`); logic.apply(ji, si); }} style={{ fontWeight: logic.state.journey === ji && logic.state.stepIdx === si ? 700 : 400 }}>{st[0]}</a>
                </li>
              ))}
            </ol>
          </details>
        ))}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={v.setAM}>Morning</button><button onClick={v.setPM}>Evening</button><button onClick={v.nextDay}>Next day</button>
        </div>
      </aside>
      <div className="app-device" data-testid="device" style={{ width: 375, height: 812, borderRadius: 40, overflow: "hidden", boxShadow: "0 30px 60px -30px rgba(42,25,17,.45)", position: "relative" }}>
        <AppFrame v={{ ...demo?.DEMO_DEFAULTS, ...v }} extraScreens={demo?.DEMO_SCREENS} extraSheets={demo?.DEMO_SHEETS} />
      </div>
    </div>
  );
}
