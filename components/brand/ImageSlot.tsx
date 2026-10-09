"use client";
import { useState } from "react";
import { slotImage } from "@/lib/assets/slots";

/**
 * Design `<image-slot>` replacement. Renders the licensed photo mapped to the
 * slot id, cropped with object-fit: cover. With no licensed asset, or if the
 * file fails to load, the slot renders nothing and the designed Grain field
 * underneath shows instead (never a broken-image icon or a diagnostic).
 */
export function ImageSlot({ slot, style, eager = false }: { slot: string; shape?: string; placeholder?: string; style?: React.CSSProperties; eager?: boolean }) {
  const [failed, setFailed] = useState(false);
  const img = slotImage(slot);
  if (!img || failed) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={img.src}
      alt={img.alt}
      data-slot={slot}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      onError={() => setFailed(true)}
      style={{ objectFit: "cover", objectPosition: img.focus, display: "block", ...style }}
    />
  );
}
