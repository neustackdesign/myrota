import { COLOR, type RingSegment } from "@/lib/ui/ring";

/**
 * Rota Ring — seven segments with a gap at twelve (Brand v4).
 * Rebuilt from the Brand v4 / Component System spec; the original <RotaRing>
 * source component was not supplied (see docs/ASSET_MANIFEST.md).
 *
 * Done: skin tone (non-monotonic). Recovery done / rescued: Sea glass (rescued
 * adds a dotted Tide hairline so it never reads as a real completion).
 * Today: Ember. Missed: thin Sienna hairline on the track. Future: track.
 */
export interface RotaRingProps {
  segments: RingSegment[];
  size?: number;
  strokeWidth?: number;
  track?: string;
  /** Index of a segment that just completed: animates its fill (520ms). */
  fillIndex?: number | null;
  /** Override all segment colours (e.g. Building screen on Lagoon). */
  mono?: { color: string; filled: number; trackOpacity?: number } | null;
  label?: string;
}

function arc(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const toXY = (deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
  };
  const [x1, y1] = toXY(startDeg);
  const [x2, y2] = toXY(endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${x1.toFixed(3)} ${y1.toFixed(3)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(3)} ${y2.toFixed(3)}`;
}

export function RotaRing({ segments, size = 134, strokeWidth = 12, track = COLOR.track, fillIndex = null, mono = null, label }: RotaRingProps) {
  const r = (size - strokeWidth) / 2 - 1;
  const c = size / 2;
  const gap = 7;
  const span = 360 / 7;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {Array.from({ length: 7 }, (_, i) => {
        const start = i * span + gap / 2;
        const end = (i + 1) * span - gap / 2;
        const d = arc(c, c, r, start, end);
        if (mono) {
          const on = i < mono.filled;
          return (
            <path key={i} d={d} fill="none" strokeLinecap="butt" strokeWidth={strokeWidth} stroke={mono.color} strokeOpacity={on ? 1 : mono.trackOpacity ?? 0.22} style={{ transition: "stroke-opacity 260ms ease" }} />
          );
        }
        const seg = segments[i];
        const kind = seg?.kind ?? "future";
        const trackPath = <path d={d} fill="none" strokeWidth={strokeWidth} stroke={track} />;
        if (kind === "future" || kind === "future_recovery") return <g key={i}>{trackPath}</g>;
        if (kind === "missed") {
          return (
            <g key={i}>
              {trackPath}
              <path d={d} fill="none" strokeWidth={2} stroke={COLOR.sienna} />
            </g>
          );
        }
        const animate = fillIndex === i;
        return (
          <g key={i}>
            {trackPath}
            <path
              d={d}
              fill="none"
              strokeWidth={strokeWidth}
              stroke={seg.color}
              pathLength={1}
              className={animate ? "ring-fill" : undefined}
            />
            {kind === "rescued" ? (
              <path d={d} fill="none" strokeWidth={2} stroke={COLOR.tide} strokeDasharray="2 3" />
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

/** Static seven-tone ring for icons and the wordmark o. */
export function ToneRing({ tones, size = 40, strokeWidth = 8, track = COLOR.track }: { tones: string[]; size?: number; strokeWidth?: number; track?: string }) {
  const r = (size - strokeWidth) / 2;
  const c = size / 2;
  const span = 360 / 7;
  const gap = 8;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      {Array.from({ length: 7 }, (_, i) => (
        <path key={i} d={arc(c, c, r, i * span + gap / 2, (i + 1) * span - gap / 2)} fill="none" strokeWidth={strokeWidth} stroke={tones[i] ?? track} />
      ))}
    </svg>
  );
}
