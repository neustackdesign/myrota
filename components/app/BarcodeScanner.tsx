"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";

/**
 * In-browser barcode detection, not ingredient OCR. Camera frames never leave
 * this device. Only the decoded EAN / UPC / GTIN is sent to catalogue search.
 * Dynamic import avoids loading ZXing on regular PWA entry.
 */
export function BarcodeScanner({
  onFound,
  onClose,
}: {
  onFound: (code: string) => void;
  onClose: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const scanner = useRef<{ stop: () => void } | null>(null);
  const found = useRef(false);
  const handlers = useRef({ onFound, onClose });
  handlers.current = { onFound, onClose };
  const [state, setState] = useState("Starting camera…");
  const [readingPhoto, setReadingPhoto] = useState(false);

  useEffect(() => {
    let active = true;
    async function start() {
      if (!navigator.mediaDevices?.getUserMedia || !video.current) {
        setState("Camera not supported here. Use a barcode photo or enter its digits.");
        return;
      }
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        if (!active || !video.current) return;
        const reader = new BrowserMultiFormatReader();
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } }, audio: false },
          video.current,
          (result) => {
            if (!active || found.current || !result) return;
            const code = result.getText()?.trim() ?? "";
            if (!/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(code)) return;
            found.current = true;
            scanner.current?.stop();
            handlers.current.onFound(code);
          },
        );
        if (!active) controls.stop();
        else {
          scanner.current = controls;
          setState("Aim at the barcode on the package.");
        }
      } catch {
        if (active) setState("Camera unavailable. Choose a barcode photo or enter the digits manually.");
      }
    }
    void start();
    return () => {
      active = false;
      scanner.current?.stop();
      scanner.current = null;
    };
  }, []);

  async function fromPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file || found.current || readingPhoto) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 8 * 1024 * 1024) {
      setState("Choose a JPG, PNG or WebP barcode photo under 8 MB.");
      return;
    }
    setReadingPhoto(true);
    const url = URL.createObjectURL(file);
    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const result = await new BrowserMultiFormatReader().decodeFromImageUrl(url);
      const code = result.getText().trim();
      if (!/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(code)) {
        setState("No supported product barcode found. Try another picture.");
        return;
      }
      found.current = true;
      scanner.current?.stop();
      handlers.current.onFound(code);
    } catch {
      setState("Couldn’t read a barcode. Try a clearer picture, or enter the digits.");
    } finally {
      URL.revokeObjectURL(url);
      setReadingPhoto(false);
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Scan product barcode" style={{
      position: "fixed", inset: 0, zIndex: 1200, background: "#2A1911", color: "#FBFAF6",
      padding: "max(20px, env(safe-area-inset-top)) 20px max(20px, env(safe-area-inset-bottom))",
      display: "flex", flexDirection: "column", gap: 16, boxSizing: "border-box",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <strong style={{ fontSize: 18 }}>Find by barcode</strong>
        <button type="button" onClick={() => handlers.current.onClose()} style={{
          border: "1px solid #C99A72", borderRadius: 999, background: "transparent",
          color: "#FBFAF6", padding: "12px 16px", font: "inherit", cursor: "pointer",
        }}>Close</button>
      </div>
      <div style={{ position: "relative", flex: 1, minHeight: 140, maxHeight: "65vh", overflow: "hidden", borderRadius: 20, border: "1px solid #845535", background: "#160D09" }}>
        <video ref={video} autoPlay playsInline muted aria-label="Camera preview for the product barcode" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        <div aria-hidden="true" style={{ position: "absolute", inset: "29% 10%", border: "2px solid #FBFAF6", borderRadius: 12, pointerEvents: "none" }} />
      </div>
      <p role="status" aria-live="polite" style={{ margin: 0, fontSize: 15, lineHeight: 1.45 }}>{state}</p>
      <label style={{
        display: "block", borderRadius: 999, background: "#EE6F3E", color: "#2A1911",
        fontWeight: 700, padding: "16px 20px", textAlign: "center", cursor: "pointer",
      }}>
        {readingPhoto ? "Reading photo…" : "Choose a barcode photo"}
        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={fromPhoto} disabled={readingPhoto} style={{ position: "absolute", width: 1, height: 1, opacity: 0 }} />
      </label>
      <button type="button" onClick={() => handlers.current.onClose()} style={{
        padding: "12px", border: 0, background: "transparent", font: "inherit",
        color: "#FBFAF6", textDecoration: "underline", cursor: "pointer",
      }}>Enter the barcode digits instead</button>
      <p style={{ fontSize: 12, lineHeight: 1.4, opacity: .75, margin: 0 }}>
        A barcode can match a product listing, not verify its current ingredients or safety. You’ll confirm the product before saving.
      </p>
    </div>
  );
}
