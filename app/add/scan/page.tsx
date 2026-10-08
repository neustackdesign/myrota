"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { RotaRing } from "@/components/brand/RotaRing";
import { BackButton, Button, InlineError } from "@/components/ui/primitives";
import { PasteSheet } from "@/components/sheets/product";
import { PROBLEM_TEXT } from "@/lib/client/drafts";
import { useFlow, type ScanFor } from "@/lib/client/flow";
import { DEMO_MODE, useRepository } from "@/lib/client/runtime";
import { COLOR } from "@/lib/ui/ring";

type Stage = "permission" | "starting" | "view" | "denied" | "processing";

function Scan() {
  const params = useSearchParams();
  const router = useRouter();
  const repo = useRepository();
  const { flow, update } = useFlow();
  const scanFor = (params.get("for") as ScanFor) ?? flow.scanFor;
  const side = params.get("side") === "front" ? "front" : "back";
  const [stage, setStage] = useState<Stage>("permission");
  const [problem, setProblem] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [proc, setProc] = useState(0);
  const [paste, setPaste] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const stop = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }, []);
  useEffect(() => stop, [stop]);

  useEffect(() => {
    if (stage !== "processing") return;
    setProc(0);
    const id = setInterval(() => setProc((n) => (n >= 7 ? 0 : n + 1)), 170);
    return () => clearInterval(id);
  }, [stage]);

  const startCamera = async () => {
    setStage("starting");
    setProblem(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("no camera");
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1920 } }, audio: false });
      stream.current = s;
      setStage("view");
      requestAnimationFrame(() => {
        if (video.current) {
          video.current.srcObject = s;
          void video.current.play().catch(() => {});
        }
      });
    } catch {
      setStage(DEMO_MODE ? "view" : "denied");
    }
  };

  const send = async (method: "scan" | "gallery" | "paste", blob?: Blob, text?: string) => {
    setStage("processing");
    setProblem(null);
    setError(null);
    try {
      const res = await repo.extract({ method, side, pastedText: text }, blob);
      if (!res.ok) {
        setProblem(PROBLEM_TEXT[res.problem]);
        setStage(stream.current || DEMO_MODE ? "view" : "permission");
        return;
      }
      stop();
      // A front-label shot only adds identity to the back-label draft; ingredients are never replaced by it.
      const merged =
        side === "front" && flow.draft
          ? { ...flow.draft, name: res.candidate.name ?? flow.draft.name, brand: res.candidate.brand ?? flow.draft.brand, identityStatus: res.candidate.identityStatus, identityKey: res.candidate.identityKey, variant: res.candidate.variant }
          : res.candidate;
      update({ draft: merged, draftMethod: side === "front" ? flow.draftMethod ?? method : method, scanFor });
      router.replace(side === "front" ? "/add/review?front=1" : "/add/review");
    } catch (e) {
      setError(e);
      setStage(stream.current || DEMO_MODE ? "view" : "permission");
    }
  };

  const shutter = async () => {
    const v = video.current;
    if (v && stream.current && v.videoWidth) {
      const canvas = document.createElement("canvas");
      canvas.width = v.videoWidth;
      canvas.height = v.videoHeight;
      canvas.getContext("2d")?.drawImage(v, 0, 0);
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
      await send("scan", blob ?? undefined);
    } else {
      await send("scan");
    }
  };

  return (
    <div className="app-frame app-frame--dark">
      <main id="main" className="app-main" style={{ minHeight: "100dvh" }}>
        <div className="pad top-pad row on-dark" style={{ paddingBottom: 12 }}>
          <BackButton onDark fallback="/build" />
          <span className="t-kicker" style={{ marginLeft: "auto" }}>{stage === "permission" ? "Scan" : side === "front" ? "Front label · name" : "Back label · ingredients"}</span>
        </div>

        {stage === "permission" || stage === "starting" || stage === "denied" ? (
          <div className="pad grow" style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", paddingBottom: "calc(20px + env(safe-area-inset-bottom))" }}>
            <div className="card stack" style={{ color: COLOR.ebony, borderRadius: 24, padding: 20 }}>
              {stage === "denied" ? (
                <>
                  <h1 className="t-display t-h2">Camera is blocked</h1>
                  <p className="t-body t-muted">Allow camera access for this site in your browser settings, or add the product another way. Nothing is lost.</p>
                </>
              ) : (
                <>
                  <h1 className="t-display t-h2">{side === "front" ? "Snap the front label" : "Scan the back label first"}</h1>
                  <p className="t-body t-muted">
                    {side === "front"
                      ? "We only need the front when we couldn't read the name."
                      : "The ingredient list tells us more than the name. We use your camera only while this screen is open. Photos are read, then discarded."}
                  </p>
                </>
              )}
              {problem ? <p role="alert" className="note note--sienna" style={{ margin: 0 }}>{problem}</p> : null}
              <InlineError error={error} />
              {stage !== "denied" ? <Button variant="primary" busy={stage === "starting"} onClick={startCamera}>Use camera</Button> : <Button variant="primary" onClick={startCamera}>Try camera again</Button>}
              <Button onClick={() => galleryRef.current?.click()}>Choose from gallery</Button>
              <Button variant="text" onClick={() => setPaste(true)}>Paste the ingredient list instead</Button>
            </div>
          </div>
        ) : (
          <div className="pad grow stack center on-dark" style={{ paddingBottom: "calc(24px + env(safe-area-inset-bottom))", ["--gap" as string]: "14px" }}>
            <p className="t-lede" style={{ maxWidth: 300 }}>{side === "front" ? "Fill the frame with the product name." : "Fill the frame with the ingredient list."}</p>
            <div className="viewfinder">
              <video ref={video} playsInline muted aria-label="Camera preview" />
              {!stream.current ? (
                <div style={{ position: "absolute", left: 44, right: 44, top: "50%", marginTop: -50, display: "flex", flexDirection: "column", gap: 9, opacity: 0.55 }} aria-hidden>
                  {[100, 84, 92, 70, 88].map((w, i) => <span key={i} style={{ height: 7, width: `${w}%`, borderRadius: 4, background: COLOR.track }} />)}
                </div>
              ) : null}
              <div className="viewfinder__corners" aria-hidden />
              {problem ? (
                <div role="alert" style={{ position: "absolute", left: 12, right: 12, bottom: 12, background: COLOR.porcelain, color: COLOR.ebony, borderRadius: 16, padding: "12px 14px", fontSize: 14, lineHeight: 1.4, textAlign: "left" }}>
                  <b>Retake needed.</b> {problem}
                </div>
              ) : null}
              {stage === "processing" ? (
                <div className="viewfinder__overlay" role="status" aria-live="polite">
                  <RotaRing segments={[]} size={72} strokeWidth={14} mono={{ color: COLOR.porcelain, filled: proc, trackOpacity: 0.25 }} />
                  Reading the label
                </div>
              ) : null}
            </div>
            <InlineError error={error} />
            {DEMO_MODE && !stream.current ? <p className="t-small" style={{ color: "#BFE4DD" }}>Demo: no camera here. The shutter sends a simulated label.</p> : null}
            <div className="row" style={{ width: "100%", justifyContent: "space-between" }}>
              <button type="button" className="btn btn--text" onClick={() => galleryRef.current?.click()}>Gallery</button>
              <button type="button" className="shutter" aria-label="Take photo" onClick={shutter} disabled={stage === "processing"} />
              <button type="button" className="btn btn--text" onClick={() => setPaste(true)}>Paste</button>
            </div>
          </div>
        )}
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void send("gallery", file);
          }}
        />
      </main>
      <PasteSheet open={paste} onClose={() => setPaste(false)} busy={stage === "processing"} error={null} onRead={(t) => { setPaste(false); void send("paste", undefined, t); }} />
    </div>
  );
}

export default function ScanPage() {
  return (
    <Suspense fallback={null}>
      <Scan />
    </Suspense>
  );
}
