import Link from "next/link";
import { Wordmark } from "@/components/brand/Wordmark";

/** Plain Brand v4 page for legal/company information linked from the landing footer. */
export function InfoPage({ kicker, title, children }: { kicker: string; title: string; children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100dvh", background: "#F7EFE7", color: "#2A1911" }}>
      <header style={{ maxWidth: 760, margin: "0 auto", padding: "24px clamp(16px,4vw,48px)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Link href="/" aria-label="myrota home" style={{ textDecoration: "none" }}><Wordmark size={24} ink="#2A1911" accent="#2A1911" /></Link>
        <Link href="/app?src=info" style={{ fontWeight: 600 }}>Open myrota</Link>
      </header>
      <main id="main" style={{ maxWidth: 760, margin: "0 auto", padding: "24px clamp(16px,4vw,48px) 96px", display: "flex", flexDirection: "column", gap: 16, fontSize: 17, lineHeight: 1.55 }}>
        <span style={{ fontFamily: "var(--font-geist-mono),monospace", fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: "#5A3824" }}>{kicker}</span>
        <h1 style={{ fontFamily: "var(--font-faculty-glyphic),serif", fontWeight: 400, fontSize: "clamp(40px,6vw,64px)", lineHeight: 1, letterSpacing: "-0.03em", margin: "0 0 8px" }}>{title}</h1>
        <div className="info-prose" style={{ display: "flex", flexDirection: "column", gap: 14 }}>{children}</div>
      </main>
    </div>
  );
}
