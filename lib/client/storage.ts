"use client";

import type { AppState } from "@/lib/domain/types";

const KEY = "myrota.state.v1";

export const EMPTY_STATE: AppState = {
  selectedProductIds: [],
  context: {},
  rota: null,
  completions: {},
};

export function loadState(): AppState {
  if (typeof window === "undefined") return EMPTY_STATE;

  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY_STATE;
    return { ...EMPTY_STATE, ...JSON.parse(raw) } as AppState;
  } catch {
    return EMPTY_STATE;
  }
}

export function saveState(state: AppState) {
  window.localStorage.setItem(KEY, JSON.stringify(state));
}

export function clearState() {
  window.localStorage.removeItem(KEY);
}
