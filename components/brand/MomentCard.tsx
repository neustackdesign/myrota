import { RotaRing } from "./RotaRing";

/** Moment card (name · action · meta + mini ring) — port of Brand v4 `MomentCard.dc.html`. */
export function MomentCard({ who = "", what = "", meta = "", filled = 5, hollow = -1, rescued = "", style }: { who?: string; what?: string; meta?: string; filled?: number | string; hollow?: number | string; rescued?: string; style?: React.CSSProperties }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 10, background: "#FBFAF6", borderRadius: 18, padding: "10px 14px 10px 10px", boxShadow: "0 16px 40px -12px rgba(42,25,17,.28)", color: "#2A1911", fontFamily: "var(--font-geist),system-ui,sans-serif", maxWidth: "100%", boxSizing: "border-box", ...style }}>
      <div style={{ flex: "none", display: "flex" }}>
        <RotaRing size={28} filled={filled} hollow={hollow} rescued={rescued} lit={-1} sw={16} tones="#E8CDB9,#C99A72,#845535,#DDBB9C,#A8764F,#E8CDB9,#5A3824" track="#E8D8C9" />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <span style={{ fontSize: 14, lineHeight: 1.3, whiteSpace: "nowrap" }}><b style={{ fontWeight: 600 }}>{who}</b> {what}</span>
        <span style={{ fontFamily: "var(--font-geist-mono),ui-monospace,monospace", fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase", color: "#5A3824", whiteSpace: "nowrap" }}>{meta}</span>
      </div>
    </div>
  );
}
