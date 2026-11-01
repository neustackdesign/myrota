"use client";
import { useEffect, useRef, useState } from "react";
import { grainBackground, grainBase } from "@/lib/brand/grain";

/** Grain field — port of Brand v4 `Grain.dc.html`. Size snaps to 8px like the source. */
export function Grain({ preset = "dusk", spray = 1, grain = 1, seed = 4, style }: { preset?: string; spray?: number; grain?: number; seed?: number; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const up = () => {
      const w = Math.round(el.offsetWidth / 8) * 8, h = Math.round(el.offsetHeight / 8) * 8;
      setSize((s) => (s.w === w && s.h === h ? s : { w, h }));
    };
    const ro = new ResizeObserver(up);
    ro.observe(el);
    up();
    return () => ro.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      aria-hidden="true"
      style={{ width: "100%", height: "100%", borderRadius: "inherit", backgroundColor: grainBase(preset), backgroundImage: grainBackground(preset, size.w, size.h, spray, grain, seed), backgroundSize: "100% 100%", pointerEvents: "none", ...style }}
    />
  );
}
