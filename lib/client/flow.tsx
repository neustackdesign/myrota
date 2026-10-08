"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { ExtractionCandidate, MixSubjectRef } from "../api/contract";
import type { PlanContext } from "../domain/types";

/**
 * Transient, in-memory journey state (builder source, Mix carry, current scan
 * draft). Lost on reload by design: durable data lives on the server, and this
 * never substitutes for it.
 */

export type BuildSource = "organic" | "invite" | "mix" | "shelf";
export type ScanFor = "add" | "shelf" | "mix";

export interface MixPick {
  ref: MixSubjectRef;
  name: string;
  category: string;
}

export interface FlowState {
  source: BuildSource;
  inviteToken: string | null;
  inviterName: string | null;
  mixA: MixPick | null;
  mixB: MixPick | null;
  mixSlot: "a" | "b";
  /** The Mix pair carried into the builder after "Build a rota with these". */
  mixCarry: { a: MixPick; b: MixPick; verdictLabel: string; firstReason: string | null } | null;
  scanFor: ScanFor;
  draft: ExtractionCandidate | null;
  draftMethod: "scan" | "gallery" | "paste" | null;
}

const initial: FlowState = {
  source: "organic",
  inviteToken: null,
  inviterName: null,
  mixA: null,
  mixB: null,
  mixSlot: "a",
  mixCarry: null,
  scanFor: "add",
  draft: null,
  draftMethod: null,
};

const FlowContext = createContext<{ flow: FlowState; update: (patch: Partial<FlowState>) => void; reset: () => void } | null>(null);

export function FlowProvider({ children }: { children: ReactNode }) {
  const [flow, setFlow] = useState<FlowState>(initial);
  const value = useMemo(
    () => ({ flow, update: (patch: Partial<FlowState>) => setFlow((f) => ({ ...f, ...patch })), reset: () => setFlow(initial) }),
    [flow],
  );
  return <FlowContext.Provider value={value}>{children}</FlowContext.Provider>;
}

export function useFlow() {
  const ctx = useContext(FlowContext);
  if (!ctx) throw new Error("FlowProvider missing");
  return ctx;
}

// ---------------------------------------------------------------------------
// Private plan context — intentionally DEVICE-LOCAL (CLAUDE.md: safety context
// remains on device, never merged or shared). This is not a fallback store for
// server data; it is the only home of these answers. Sent transiently with
// POST /api/rotas so holds apply, and never included in shares or friend data.
// ---------------------------------------------------------------------------

const CONTEXT_KEY = "myrota.private-context.v1";

export function readPrivateContext(): PlanContext | null {
  try {
    const raw = window.localStorage.getItem(CONTEXT_KEY);
    return raw ? (JSON.parse(raw) as PlanContext) : null;
  } catch {
    return null;
  }
}

export function writePrivateContext(ctx: PlanContext) {
  try {
    window.localStorage.setItem(CONTEXT_KEY, JSON.stringify(ctx));
  } catch {
    /* private mode / storage blocked: answers apply to this build only */
  }
}
