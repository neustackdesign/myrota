import { ImageResponse } from "next/og";

export const alt = "myrota — Your shelf, in the right order.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Branded link preview (1200×630). Typographic only: no product names, no user data, no photography rights needed. */
export default function OpenGraphImage() {
  const C = 2 * Math.PI * 42, seg = C / 7, g = 7, d = seg - g;
  const tones = ["#E8CDB9", "#C99A72", "#845535", "#DDBB9C", "#A8764F", "#9ED8CF", "#5A3824"];
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#1E3A3C", color: "#FBFAF6", padding: 72, justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 28, maxWidth: 640 }}>
          <div style={{ fontSize: 40, letterSpacing: -1, display: "flex" }}>myrota</div>
          <div style={{ display: "flex", flexDirection: "column", fontSize: 96, lineHeight: 0.92, letterSpacing: -3 }}>
            <span>Your shelf,</span>
            <span style={{ color: "rgba(251,250,246,.55)" }}>in order.</span>
          </div>
          <div style={{ fontSize: 28, color: "rgba(251,250,246,.8)" }}>A seven-day skincare rota from what you already own.</div>
        </div>
        <div style={{ width: 360, height: 360, borderRadius: 999, background: "#FBFAF6", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="320" height="320" viewBox="0 0 100 100">
            {tones.map((t, i) => (
              <circle key={i} cx="50" cy="50" r="42" transform="rotate(-90 50 50)" fill="none" stroke={t} strokeWidth="12" strokeDasharray={`${d} ${C - d}`} strokeDashoffset={-g / 2 - i * seg} />
            ))}
          </svg>
        </div>
      </div>
    ),
    size,
  );
}
