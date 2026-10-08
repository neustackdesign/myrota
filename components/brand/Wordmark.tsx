import { COLOR } from "@/lib/ui/ring";
import { ToneRing } from "./RotaRing";

/**
 * myrota wordmark: Faculty Glyphic with the ring "o" (seven segments, gap at
 * twelve). Reconstructed from Brand v4 specimens; replace with the frozen
 * vector master when supplied (docs/ASSET_MANIFEST.md · BR-01).
 */
export function Wordmark({ size = 30, ink = COLOR.ebony, accent = COLOR.ember, label = true }: { size?: number; ink?: string; accent?: string; label?: boolean }) {
  const o = Math.round(size * 0.56);
  const tones = [accent, ink, ink, ink, ink, ink, ink];
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label ? "myrota" : undefined}
      aria-hidden={label ? undefined : true}
      style={{ display: "inline-flex", alignItems: "baseline", fontFamily: "var(--font-display)", fontSize: size, lineHeight: 1, color: ink, letterSpacing: "-0.02em" }}
    >
      <span aria-hidden>myr</span>
      <span aria-hidden style={{ display: "inline-block", width: o, height: o, margin: `0 ${size * 0.02}px`, transform: `translateY(${size * 0.04}px)` }}>
        <ToneRing tones={tones} size={o} strokeWidth={Math.max(2, o * 0.2)} track={ink} />
      </span>
      <span aria-hidden>ta</span>
    </span>
  );
}
