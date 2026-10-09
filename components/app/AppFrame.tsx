"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Fragment, useEffect, useRef } from "react";
import { Grain } from "@/components/brand/Grain";
import { RotaMarker } from "@/components/brand/RotaMarker";
import { RotaRing } from "@/components/brand/RotaRing";
import { Wordmark } from "@/components/brand/Wordmark";
import { SCREENS, SHEETS } from "./screens";

/**
 * The v1.6 app chrome without the prototype's simulation furniture (fake
 * status bar, fake URL bar, fake OS permission dialog, home indicator).
 * On phones it fills the viewport; on wider screens the same mobile-first
 * column is centred at a readable width with the screen's own surface
 * colour bleeding to the edges (no scaled-up phone frame).
 */
export function AppFrame({ v, banner }: { v: any; banner?: React.ReactNode }) {
  const screenKey = Object.keys(v.S || {}).find((k) => v.S[k]) ?? "welcome";
  const sheetKey = Object.keys(v.SH || {}).find((k) => v.SH[k]) ?? null;
  const Screen = SCREENS[screenKey] ?? SYSTEM_SCREENS[screenKey];
  const Sheet = sheetKey ? SHEETS[sheetKey] : null;
  const sheetRef = useRef<HTMLDivElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!v.sheetOn) return;
    lastFocus.current = document.activeElement as HTMLElement | null;
    const el = sheetRef.current;
    const t = setTimeout(() => {
      const first = el?.querySelector<HTMLElement>("button, a[href], input, textarea, select, [tabindex]:not([tabindex='-1'])");
      (first ?? el)?.focus({ preventScroll: true });
    }, 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); v.closeSheet?.(); }
      if (e.key === "Tab" && el) {
        const f = Array.from(el.querySelectorAll<HTMLElement>("button, a[href], input, textarea, select, [tabindex]:not([tabindex='-1'])")).filter((x) => !x.hasAttribute("disabled"));
        if (!f.length) return;
        const a = f[0], z = f[f.length - 1];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
        else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      lastFocus.current?.focus?.({ preventScroll: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v.sheetOn, sheetKey]);

  return (
    <div className="app-outer" style={{ background: v.phoneBg }} data-screen={screenKey} data-sheet={sheetKey ?? ""}>
      <div className="app-col" style={{ background: v.phoneBg }}>
        {banner}
        <main id="main" className="app-screen" aria-hidden={v.sheetOn ? true : undefined}>
          <div style={{ position: "absolute", inset: 0, transform: v.tx, opacity: v.op, transition: v.tr }}>
            {Screen ? <Fragment key={screenKey}>{Screen(v)}</Fragment> : null}
          </div>
        </main>
        {v.tabsOn ? (
          <nav aria-label="Main" className="app-tabs" aria-hidden={v.sheetOn ? true : undefined}>
            {(v.tabs ?? []).map((t: any) => (
              <button key={t.label} onClick={t.go} aria-current={t.pill !== "transparent" ? "page" : undefined} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: "none", border: "none", cursor: "pointer", padding: "4px 0", minHeight: 56, fontSize: 11, fontWeight: 600, fontFamily: "inherit", color: t.ink }}>
                <RotaMarker icon={t.icon} size={28} mode={t.mode} ink={t.ink} />
                <span style={{ width: 20, height: 4, borderRadius: 4, background: t.pill }} />
                <span>{t.label}</span>
              </button>
            ))}
          </nav>
        ) : null}
        {v.sheetOn && Sheet ? (
          <div style={{ position: "absolute", inset: 0, zIndex: 20, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
            <div onClick={v.closeSheet} aria-hidden="true" style={{ position: "absolute", inset: 0, background: "rgba(42,25,17,.72)", WebkitBackdropFilter: "blur(6px)", backdropFilter: "blur(6px)", opacity: v.scrimOp, transition: "opacity 260ms" }} />
            <div ref={sheetRef} role="dialog" aria-modal="true" aria-label={v.sheetLabel ?? "Details"} tabIndex={-1} className="app-sheet" style={{ transform: v.sheetT }}>
              <div style={{ width: 40, height: 5, borderRadius: 3, background: "#E8D8C9", margin: "0 auto 16px" }} />
              {Sheet(v)}
            </div>
          </div>
        ) : null}
        {v.toastOn ? (
            <div role="status" aria-live="polite" style={{ position: "absolute", left: 16, right: 16, bottom: "calc(12px + env(safe-area-inset-bottom))", zIndex: 40, background: "#2A1911", color: "#FBFAF6", borderRadius: 16, padding: "11px 14px", display: "flex", gap: 10, alignItems: "center", fontSize: 13, fontWeight: 600 }}>
              <RotaMarker icon="done" size={24} mode="colour" ink="#FBFAF6" paper="#2A1911" accent="#9ED8CF" />
              <span>{v.toast}</span>
            </div>
          ) : null}
      </div>
    </div>
  );
}

/** Production-only states not drawn in the prototype: first load and an unreachable API. Same Brand v4 vocabulary. */
const SYSTEM_SCREENS: Record<string, (v: any) => React.ReactNode> = {
  loading: () => (
    <div role="status" aria-live="polite" style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, background: "#F7EFE7" }}>
      <Grain preset="cover" style={{ position: "absolute", inset: 0 }} />
      <div style={{ position: "relative", animation: "app-spin 2.4s linear infinite" }}><RotaRing size={96} filled={3} sw={10} track="#E8D8C9" accent="#EE6F3E" /></div>
      <div style={{ position: "relative" }}><Wordmark size={30} ink="#2A1911" accent="#EE6F3E" /></div>
      <span className="sr-only">Loading your rota</span>
    </div>
  ),
  error: (v: any) => (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: 16, padding: "24px", background: "#F7EFE7" }}>
      <Wordmark size={30} ink="#2A1911" accent="#EE6F3E" />
      <h1 style={{ margin: "12px 0 0", fontFamily: "var(--font-faculty-glyphic),serif", fontWeight: 400, fontSize: 40, lineHeight: 1 }}>We can&apos;t reach myrota right now.</h1>
      <p role="alert" style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: "#5A3824" }}>{v.bootError || "Check your connection and try again."} Nothing on your shelf was changed.</p>
      <button onClick={v.retryBoot} className="dc-a50ed28" style={{ minHeight: 52, background: "#EE6F3E", color: "#2A1911", border: "2px solid #2A1911", borderRadius: 999, fontWeight: 600, fontSize: 16, boxShadow: "3px 4px 0 #2A1911", cursor: "pointer" }}>Try again</button>
    </div>
  ),
};
