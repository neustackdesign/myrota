"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { getRelationship, RELATIONSHIP_LABEL } from "@/lib/domain/rules";
import type { ActiveClass } from "@/lib/domain/types";

const OPTIONS: Array<{ value: ActiveClass; label: string }> = [
  { value: "retinoid", label: "Retinoid" },
  { value: "aha", label: "AHA" },
  { value: "bha", label: "BHA" },
  { value: "vitamin_c_laa", label: "Vitamin C (L-ascorbic acid)" },
  { value: "niacinamide", label: "Niacinamide" },
  { value: "azelaic_acid", label: "Azelaic acid" },
];

export default function MixPage() {
  const [left, setLeft] = useState<ActiveClass>("retinoid");
  const [right, setRight] = useState<ActiveClass>("bha");

  const result = useMemo(() => getRelationship(left, right), [left, right]);

  return (
    <main className="shell">
      <header className="topbar">
        <Link className="brand" href="/">myrota</Link>
        <Link className="pill" href="/build">Build my rota</Link>
      </header>

      <section className="section">
        <div className="eyebrow">Mix check</div>
        <h1 style={{ fontSize: "clamp(42px, 10vw, 70px)" }}>
          Can I use these together?
        </h1>
        <p className="lede">
          Pick two actives. We will tell you how the current rota engine handles
          the pair.
        </p>
      </section>

      <section className="card stack">
        <label className="stack">
          <span className="muted">First active</span>
          <select
            className="input"
            value={left}
            onChange={(event) => setLeft(event.target.value as ActiveClass)}
          >
            {OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        <label className="stack">
          <span className="muted">Second active</span>
          <select
            className="input"
            value={right}
            onChange={(event) => setRight(event.target.value as ActiveClass)}
          >
            {OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      </section>

      <section className="section card">
        <div className="eyebrow">Verdict</div>
        <h2>{RELATIONSHIP_LABEL[result.relationship]}</h2>
        <p className="lede">{result.explanation}</p>
        <Link className="button lime" href="/build">
          Build this into my rota →
        </Link>
      </section>
    </main>
  );
}
