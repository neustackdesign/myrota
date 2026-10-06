"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { loadState, saveState } from "@/lib/client/storage";
import {
  calculateStreak,
  isDayComplete,
  rescueCandidate,
} from "@/lib/domain/streak";
import type { AppState } from "@/lib/domain/types";

function dayIndexFromStart(startDate: string) {
  const start = new Date(`${startDate}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const difference = Math.floor(
    (today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
  );
  return Math.min(6, Math.max(0, difference));
}

export default function RoutinePage() {
  const [state, setState] = useState<AppState | null>(null);
  const [viewDayIndex, setViewDayIndex] = useState(0);

  useEffect(() => {
    const next = loadState();
    setState(next);
    if (next.rota) setViewDayIndex(dayIndexFromStart(next.rota.startDate));
  }, []);

  const currentDayIndex = state?.rota
    ? dayIndexFromStart(state.rota.startDate)
    : 0;

  const streak = useMemo(() => {
    if (!state) return 0;
    return calculateStreak(
      state.completions,
      currentDayIndex,
      state.rescuedDayIndex,
    );
  }, [state, currentDayIndex]);

  if (!state?.rota) {
    return (
      <main className="shell">
        <header className="topbar"><Link className="brand" href="/">myrota</Link></header>
        <section className="hero">
          <h1>No rota yet.</h1>
          <p className="lede">Add what you own and build your first week.</p>
          <Link className="button lime" href="/build">Build my rota →</Link>
        </section>
      </main>
    );
  }

  const day = state.rota.days[viewDayIndex];
  const completion = state.completions[viewDayIndex] ?? { am: false, pm: false };
  const canComplete = viewDayIndex === currentDayIndex;
  const rescueDay = rescueCandidate(
    state.completions,
    currentDayIndex,
    state.rescuedDayIndex,
  );

  function updateCompletion(slot: "am" | "pm") {
    if (!state || viewDayIndex !== currentDayIndex) return;

    const next: AppState = {
      ...state,
      completions: {
        ...state.completions,
        [viewDayIndex]: {
          ...(state.completions[viewDayIndex] ?? { am: false, pm: false }),
          [slot]: !(state.completions[viewDayIndex]?.[slot] ?? false),
        },
      },
    };
    saveState(next);
    setState(next);
  }

  function useRescue() {
    if (!state || rescueDay === undefined) return;
    const next = { ...state, rescuedDayIndex: rescueDay };
    saveState(next);
    setState(next);
  }

  async function inviteFriend() {
    const url = `${window.location.origin}/invite/first?from=myrota`;
    const text =
      "I’m doing a 7-day skincare rota instead of guessing what to use. Do yours with me.";

    if (navigator.share) {
      await navigator.share({ title: "Do a Skin Streak with me", text, url });
      return;
    }

    window.open(
      `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  return (
    <main className="shell">
      <header className="topbar">
        <Link className="brand" href="/">myrota</Link>
        <span className="pill">🔥 {streak} day streak</span>
      </header>

      <section className="section">
        <div className="eyebrow">Your first rota</div>
        <h1 style={{ fontSize: "clamp(42px, 10vw, 70px)" }}>
          Follow the plan. Not the shelf.
        </h1>
        <p className="lede">{state.rota.explanation}</p>
      </section>

      <section className="week-strip" aria-label="Seven day rota">
        {state.rota.days.map((item) => {
          const done =
            isDayComplete(state.completions[item.index]) ||
            state.rescuedDayIndex === item.index;
          return (
            <button
              type="button"
              key={item.index}
              className={`day ${item.index === viewDayIndex ? "active" : ""} ${done ? "done" : ""}`}
              onClick={() => setViewDayIndex(item.index)}
            >
              <strong>{item.label}</strong>
              <span>{item.index === currentDayIndex ? "Today" : item.pm.theme ?? ""}</span>
            </button>
          );
        })}
      </section>

      {rescueDay !== undefined ? (
        <section className="notice">
          <strong>Missed yesterday?</strong> Use your one Rota Rescue for this
          week and keep moving forward — no doubling up.
          <div style={{ marginTop: 10 }}>
            <button className="button secondary" type="button" onClick={useRescue}>
              Use Rota Rescue
            </button>
          </div>
        </section>
      ) : null}

      <section className="section card session">
        <div className="session-head">
          <div>
            <div className="eyebrow">Morning</div>
            <h2>AM</h2>
          </div>
          <span className="pill">{day.am.steps.length} steps</span>
        </div>
        <div className="steps">
          {day.am.steps.length ? day.am.steps.map((step, index) => (
            <div className="step" key={step.productId}>
              <span>{index + 1}. {step.productName}</span>
              <span className="muted">{step.note ?? step.brand}</span>
            </div>
          )) : <p className="muted">No morning products in this test shelf.</p>}
        </div>
        <button
          type="button"
          disabled={!canComplete}
          className={`completion ${completion.am ? "done" : ""}`}
          onClick={() => updateCompletion("am")}
        >
          {completion.am ? "AM done ✓" : canComplete ? "Mark AM done" : "View only"}
        </button>
      </section>

      <section className="section card session">
        <div className="session-head">
          <div>
            <div className="eyebrow">Evening</div>
            <h2>{day.pm.theme ?? "PM"}</h2>
          </div>
          <span className="pill">{day.pm.steps.length} steps</span>
        </div>
        <div className="steps">
          {day.pm.steps.length ? day.pm.steps.map((step, index) => (
            <div className="step" key={step.productId}>
              <span>{index + 1}. {step.productName}</span>
              <span className="muted">{step.note ?? step.brand}</span>
            </div>
          )) : <p className="muted">Nothing scheduled.</p>}
        </div>
        <button
          type="button"
          disabled={!canComplete}
          className={`completion ${completion.pm ? "done" : ""}`}
          onClick={() => updateCompletion("pm")}
        >
          {completion.pm ? "PM done ✓" : canComplete ? "Mark PM done" : "View only"}
        </button>
      </section>

      {state.rota.observations.length ? (
        <section className="section">
          <div>
            <div className="eyebrow">Shelf check</div>
            <h2>Three things worth knowing.</h2>
          </div>
          <div className="stack">
            {state.rota.observations.map((observation) => (
              <article className="card" key={observation.id}>
                <h3>{observation.title}</h3>
                <p className="muted" style={{ marginTop: 8 }}>{observation.detail}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="section card">
        <div className="eyebrow">Shared streak</div>
        <h2>Easier with company.</h2>
        <p className="lede">
          Your friend gets their own rota. The shared goal is simply to keep
          showing up.
        </p>
        <button className="button lime" type="button" onClick={inviteFriend}>
          Invite one friend →
        </button>
      </section>

      <p className="footer-note">
        This browser adapter is temporary. Anonymous server persistence and
        shared friend-streak state are the next backend pass.
      </p>
    </main>
  );
}
