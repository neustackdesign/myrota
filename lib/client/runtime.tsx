"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createHttpRepository } from "../api/http-repository";
import type { RotaRepository } from "../api/repository";
import { createDemoRepository, DEMO_SCENARIOS, type DemoScenario } from "../demo/demo-repository";
import { loadTurnstileToken } from "./turnstile";

/**
 * DEMO_MODE is opt-in at build time only (NEXT_PUBLIC_MYROTA_DEMO=1). Without
 * it the app always talks to the real HTTP API and shows real error states;
 * there is no automatic fallback to fixtures or browser storage.
 */
export const DEMO_MODE = process.env.NEXT_PUBLIC_MYROTA_DEMO === "1";

interface RuntimeValue {
  repo: RotaRepository;
  demoScenario: DemoScenario | null;
}

const RuntimeContext = createContext<RuntimeValue | null>(null);

function scenarioFromUrl(): DemoScenario {
  if (typeof window === "undefined") return "fresh";
  const q = new URLSearchParams(window.location.search).get("demo");
  return (DEMO_SCENARIOS.find((s) => s.id === q)?.id ?? "fresh") as DemoScenario;
}

export function RuntimeProvider({ children }: { children: ReactNode }) {
  const [scenario] = useState<DemoScenario | null>(() => (DEMO_MODE ? scenarioFromUrl() : null));
  const value = useMemo<RuntimeValue>(
    () => ({
      repo: DEMO_MODE ? createDemoRepository(scenario ?? "fresh") : createHttpRepository({ captchaToken: loadTurnstileToken }),
      demoScenario: scenario,
    }),
    [scenario],
  );
  return <RuntimeContext.Provider value={value}>{children}</RuntimeContext.Provider>;
}

export function useRuntime() {
  const ctx = useContext(RuntimeContext);
  if (!ctx) throw new Error("RuntimeProvider missing");
  return ctx;
}

export function useRepository() {
  return useRuntime().repo;
}

export interface Resource<T> {
  data: T | undefined;
  error: unknown;
  loading: boolean;
  reload: () => void;
  setData: (next: T | ((prev: T | undefined) => T)) => void;
}

/** Load once per key; explicit reload; never substitutes fixture data on failure. */
export function useResource<T>(loader: (repo: RotaRepository) => Promise<T>, deps: unknown[] = []): Resource<T> {
  const repo = useRepository();
  const [data, setDataState] = useState<T | undefined>(undefined);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    loaderRef
      .current(repo)
      .then((d) => {
        if (alive) setDataState(d);
      })
      .catch((e: unknown) => {
        if (alive) setError(e);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo, tick, ...deps]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  const setData = useCallback((next: T | ((prev: T | undefined) => T)) => {
    setDataState((prev) => (typeof next === "function" ? (next as (p: T | undefined) => T)(prev) : next));
  }, []);
  return { data, error, loading, reload, setData };
}

/** Idempotency keys for writes. Stable per user action, so retries replay safely. */
export function newIdempotencyKey(prefix: string) {
  const rand = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  return `${prefix}:${rand}`;
}
