/** Day/time tag pill — port of Brand v4 `DayTag.dc.html`. */
const T: Record<string, [string, string]> = {
  Retinoid: ["#1E3A3C", "#FBFAF6"], Exfoliant: ["#1F7F7E", "#FBFAF6"], Recovery: ["#9ED8CF", "#2A1911"],
  Rest: ["#E3F1EC", "#2A1911"], Morning: ["#F6B48F", "#2A1911"], Evening: ["#1E3A3C", "#FBFAF6"],
  Rescued: ["transparent", "#2A1911"], SPF: ["#FFE3B3", "#2A1911"], Unknown: ["transparent", "#5A3824"],
  Daily: ["#F1E0D2", "#2A1911"],
};

export function DayTag({ tag = "Retinoid", label, variant = "pill", size = 11, onDark = false }: { tag?: string; label?: string; variant?: "pill" | "inline"; size?: number | string; onDark?: boolean }) {
  const [bg, ink] = T[tag] || T.Retinoid;
  const inline = variant === "inline";
  const edge = tag === "Rescued" ? "inset 0 0 0 1.5px #1F7F7E" : tag === "Unknown" ? "inset 0 0 0 1.5px #845535" : bg === "#E3F1EC" && !inline ? "inset 0 0 0 1px rgba(42,25,17,.12)" : "none";
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center", whiteSpace: "nowrap",
        background: onDark && tag === "Rescued" ? "rgba(251,250,246,.12)" : bg,
        color: onDark && (tag === "Rescued" || tag === "Unknown") ? "#FBFAF6" : ink,
        boxShadow: edge, borderRadius: 999,
        fontFamily: inline ? "inherit" : "var(--font-geist-mono),ui-monospace,monospace",
        fontSize: inline ? "1em" : `${size}px`, letterSpacing: inline ? "inherit" : ".08em", textTransform: inline ? "none" : "uppercase",
        padding: inline ? ".04em .3em .1em" : "5px 9px", lineHeight: 1, verticalAlign: inline ? "baseline" : "middle",
      }}
    >
      {label || tag}
    </span>
  );
}
