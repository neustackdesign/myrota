"use client";

import { useMemo, useState } from "react";
import { ToneRing } from "@/components/brand/RotaRing";
import { Wordmark } from "@/components/brand/Wordmark";
import { Button, InlineError, Sheet, useToast } from "@/components/ui/primitives";
import { useRepository } from "@/lib/client/runtime";
import { absoluteUrl, openWhatsApp } from "@/lib/client/pwa";
import { verdictTone } from "@/lib/domain/mix";
import { buildShareCard, canShowNames, SHARE_DIMENSIONS, type ShareCardPayload, type ShareFormat, type ShareInput } from "@/lib/domain/share";
import { COLOR } from "@/lib/ui/ring";

const TITLES = { rota: "Share my rota", mix: "Share this answer", day3: "Share Day 3", day7: "Share my week", friend: "Share our streak" } as const;

/** Visual composition of a share card (9:16 · square · OG). Shared by the preview and the states gallery. */
export function ShareCardVisual({ card, ringTones }: { card: ShareCardPayload; ringTones?: string[] }) {
  const bg =
    card.kind === "mix"
      ? verdictTone(card.verdict ?? "insufficient_evidence") === "lagoon"
        ? COLOR.lagoon
        : COLOR.sienna
      : card.kind === "day3"
        ? COLOR.sand
        : card.kind === "day7"
          ? COLOR.seaGlass
          : COLOR.shell;
  const ink = card.kind === "mix" ? COLOR.porcelain : COLOR.ebony;
  const showRing = (card.kind === "rota" || card.kind === "day7") && card.format !== "og" && ringTones;
  const fs = card.format === "og" ? 22 : card.format === "square" ? 30 : 26;
  return (
    <div className={`share-card share-card--${card.format} grain`} style={{ background: bg, color: ink }} aria-label={`${SHARE_DIMENSIONS[card.format].label} preview: ${card.headline}. ${card.subline}`} role="img">
      <Wordmark size={14} ink={ink} accent={COLOR.ember} label={false} />
      {showRing ? (
        <div style={{ alignSelf: "center", width: 84, height: 84, borderRadius: "50%", background: COLOR.porcelain, display: "grid", placeItems: "center" }}>
          <ToneRing tones={ringTones!} size={74} strokeWidth={12} />
        </div>
      ) : null}
      <div>
        <div className="t-display" style={{ fontSize: fs, lineHeight: 1 }}>{card.headline}</div>
        <div style={{ fontSize: 12, fontWeight: 600, marginTop: 6 }}>{card.subline}</div>
      </div>
    </div>
  );
}

export function ShareSheet({ open, onClose, input, ringTones }: { open: boolean; onClose: () => void; input: ShareInput | null; ringTones?: string[] }) {
  const repo = useRepository();
  const toast = useToast();
  const [format, setFormat] = useState<ShareFormat>("story");
  const [showNames, setShowNames] = useState(false);
  const [busy, setBusy] = useState<"wa" | "save" | null>(null);
  const [error, setError] = useState<unknown>(null);
  const card = useMemo(() => (input ? buildShareCard(input, { format, showNames }) : null), [input, format, showNames]);
  if (!input || !card) return null;
  const titleId = "share-title";

  const send = async (via: "wa" | "save") => {
    setBusy(via);
    setError(null);
    try {
      const res = await repo.share({ card });
      if (via === "wa") {
        openWhatsApp(`${card.headline} ${card.subline}\n${absoluteUrl(res.url)}`);
        toast("WhatsApp opens. You pick the chat or Status.");
        onClose();
      } else if (res.imageUrl) {
        window.open(res.imageUrl, "_blank", "noopener");
      } else {
        toast("Image export isn't connected yet. Share the link instead.");
      }
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} labelledBy={titleId}>
      <div className="stack">
        <h2 id={titleId} className="t-display t-h2">{TITLES[input.kind]}</h2>
        <div className="share-stage">
          <ShareCardVisual card={card} ringTones={ringTones} />
        </div>
        <div className="segmented" role="group" aria-label="Format">
          {(Object.keys(SHARE_DIMENSIONS) as ShareFormat[]).map((f) => (
            <button key={f} type="button" aria-pressed={format === f} onClick={() => setFormat(f)}>
              {SHARE_DIMENSIONS[f].label}
            </button>
          ))}
        </div>
        {canShowNames(input.kind) ? (
          <button type="button" className="toggle-row" role="switch" aria-checked={showNames} onClick={() => setShowNames((v) => !v)}>
            <span>
              <span className="t-strong" style={{ display: "block", fontSize: 15 }}>{input.kind === "friend" ? "Show our names" : "Show product names"}</span>
              <span className="t-small t-muted">Off by default. Check the preview before you share.</span>
            </span>
            <span className="switch" aria-hidden />
          </button>
        ) : null}
        <p className="t-note t-muted">Your answers to private questions are never included.</p>
        <InlineError error={error} />
        <Button variant="primary" icon="share" busy={busy === "wa"} onClick={() => send("wa")}>Share on WhatsApp</Button>
        <Button busy={busy === "save"} onClick={() => send("save")}>Save image</Button>
      </div>
    </Sheet>
  );
}
