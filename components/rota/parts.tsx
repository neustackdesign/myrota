"use client";

import type { ReactNode } from "react";
import { RotaMarker, type MarkerName } from "@/components/brand/RotaMarker";
import { RotaRing } from "@/components/brand/RotaRing";
import { Avatar } from "@/components/ui/primitives";
import type { FriendSummary } from "@/lib/api/contract";
import { PROVENANCE_LABEL } from "@/lib/domain/evidence";
import type { MemberToday } from "@/lib/domain/friend-streak";
import { weekdayOf } from "@/lib/domain/skincare-day";
import type { StreakSummary } from "@/lib/domain/records";
import type { SessionView, WeekDayView } from "@/lib/domain/today";
import type { ProductCategory, RotaSnapshot, RotaStep, SafetyFlag, ShelfObservation, ShelfProduct } from "@/lib/domain/types";
import { COLOR, DONE_TONES, segmentFor, type RingSegment } from "@/lib/ui/ring";

export const CATEGORY_ICON: Record<ProductCategory, MarkerName> = {
  cleanser: "cleanser",
  toner: "water",
  serum: "serum",
  treatment: "serum",
  moisturiser: "jar",
  sunscreen: "spf",
  other: "jar",
};

export const CATEGORY_LABEL: Record<ProductCategory, string> = {
  cleanser: "Cleanser",
  toner: "Toner",
  serum: "Serum",
  treatment: "Treatment",
  moisturiser: "Moisturiser",
  sunscreen: "Sunscreen",
  other: "Other",
};

export const DAY_TYPE_LABEL = { treatment: "Treatment day", recovery: "Recovery day", daily: "Daily", rest: "Rest day" } as const;

export function shortDay(date: string) {
  return weekdayOf(date).slice(0, 3);
}

export function segmentsFor(week: WeekDayView[], todayIndex: number): RingSegment[] {
  return week.map((d) => segmentFor(d.index, d.status, d.type, d.index === todayIndex));
}

// ---------------------------------------------------------------- Ring disc
export function RingDisc({
  segments,
  size = 146,
  centre,
  label,
  pop,
  fillIndex,
}: {
  segments: RingSegment[];
  size?: number;
  centre: ReactNode;
  label: string;
  pop?: boolean;
  fillIndex?: number | null;
}) {
  return (
    <div className="ring-disc" style={{ width: size, height: size }} role="img" aria-label={label}>
      <RotaRing segments={segments} size={size - 12} strokeWidth={size > 120 ? 12 : 13} fillIndex={fillIndex} />
      <div className={`ring-centre ${pop ? "ring-num--pop" : ""}`} aria-hidden>
        {centre}
      </div>
    </div>
  );
}

export function StreakCentre({ streak, big = 46 }: { streak: StreakSummary; big?: number }) {
  return (
    <>
      <div className="ring-num" style={{ fontSize: big }}>{streak.continuity}</div>
      <div className="ring-label">{streak.state === "at_risk" ? "at risk" : "day streak"}</div>
    </>
  );
}

export function streakAria(streak: StreakSummary) {
  const base = `${streak.continuity}-day streak`;
  const split = streak.rescued ? `, ${streak.earned} earned and ${streak.rescued} rescued` : "";
  return streak.state === "at_risk" ? `${base}, held while a missed day can still be rescued` : `${base}${split}`;
}

// ---------------------------------------------------------------- Week strip
const STATUS_TEXT: Record<string, string> = {
  done: "done",
  recovery_done: "recovery day done",
  rescued: "rescued",
  today: "today",
  today_done: "today, done",
  missed: "missed",
  future: "planned",
  future_recovery: "planned recovery day",
};

export function WeekStrip({ week, todayIndex, onOpen, dark }: { week: WeekDayView[]; todayIndex: number; onOpen: (index: number) => void; dark?: boolean }) {
  const segs = segmentsFor(week, todayIndex);
  return (
    <div className={`week-strip ${dark ? "on-dark" : ""}`} role="list" aria-label="This rota's seven days">
      {week.map((d, i) => {
        const s = segs[i];
        const cls =
          s.kind === "done" || s.kind === "today_done"
            ? s.color === COLOR.seaGlass
              ? "dot dot--recovery"
              : "dot dot--done"
            : s.kind === "recovery_done"
              ? "dot dot--recovery"
              : s.kind === "rescued"
                ? "dot dot--rescued"
                : s.kind === "missed"
                  ? "dot dot--missed"
                  : s.kind === "today"
                    ? "dot dot--today"
                    : s.kind === "future_recovery"
                      ? "dot dot--future-recovery"
                      : "dot";
        const isToday = i === todayIndex;
        return (
          <div role="listitem" key={d.skincareDate}>
            <button
              type="button"
              className="day-btn"
              onClick={() => onOpen(i)}
              aria-label={`${weekdayOf(d.skincareDate)}, ${STATUS_TEXT[s.kind]}${d.swapped ? ", swapped to recovery" : ""}`}
              aria-current={isToday ? "date" : undefined}
            >
              <span className="day-btn__l" style={{ color: dark ? (isToday ? COLOR.porcelain : "#BFE4DD") : isToday ? COLOR.ebony : COLOR.umber }}>
                {weekdayOf(d.skincareDate)[0]}
              </span>
              <span className={cls} style={{ ["--d" as string]: s.color }} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------- Session card
export function StepList({ steps }: { steps: RotaStep[] }) {
  return (
    <ol className="session__steps" style={{ listStyle: "none", margin: 0 }}>
      {steps.map((s, i) => (
        <li key={`${s.productId}-${i}`} className="step">
          <span className="step__n">{i + 1}</span>
          <RotaMarker icon={CATEGORY_ICON[s.category]} size={24} />
          <div className="grow">
            <div className="t-strong" style={{ fontSize: 14 }}>{s.displayName}</div>
            <div className="t-small t-muted">{s.analysed ? CATEGORY_LABEL[s.category] : "Your choice · not analysed"}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function SessionCard({
  session,
  open,
  current,
  onToggle,
  onComplete,
  busy,
  meta,
  children,
}: {
  session: SessionView;
  open: boolean;
  current: boolean;
  onToggle: () => void;
  onComplete: () => void;
  busy?: boolean;
  meta: string;
  children?: ReactNode;
}) {
  const am = session.kind === "am";
  const title = am ? "Morning" : "Evening";
  if (session.done) {
    const at = session.doneAt ? new Date(session.doneAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : null;
    return (
      <div className="session-row session-row--done">
        <RotaMarker icon="done" size={32} mode="colour" accent={COLOR.seaGlass} />
        <div className="grow">
          <div className="t-strong" style={{ fontSize: 15 }}>{title} done</div>
          <div className="t-small t-ink-link">{at ? `Marked at ${at}` : "Marked done"}</div>
        </div>
      </div>
    );
  }
  if (!open) {
    return (
      <button type="button" className="session-row" onClick={onToggle} aria-expanded={false}>
        <RotaMarker icon={am ? "am" : "pm"} size={32} mode="colour" accent={am ? COLOR.apricot : COLOR.seaGlass} />
        <div className="grow">
          <div className="t-strong" style={{ fontSize: 15 }}>{title}</div>
          <div className="t-small t-muted">{meta}</div>
        </div>
        <span className="t-strong t-muted" style={{ fontSize: 13 }}>Open</span>
      </button>
    );
  }
  return (
    <section className={`session ${am ? "session--am" : "session--pm on-dark"}`} aria-label={`${title} session`}>
      <button type="button" className="session__head" onClick={onToggle} aria-expanded>
        <RotaMarker icon={am ? "am" : "pm"} size={34} mode="colour" ink={am ? COLOR.ebony : COLOR.porcelain} paper={am ? COLOR.porcelain : COLOR.dusk} accent={am ? COLOR.ember : COLOR.seaGlass} />
        <div className="grow">
          <div className="t-display t-h3">{title}</div>
          <div className="t-small" style={{ color: am ? COLOR.umber : "#BFE4DD", marginTop: 3 }}>{meta}</div>
        </div>
        <span className="tag tag--now" style={am ? undefined : { background: COLOR.porcelain, color: COLOR.dusk }}>{current ? "Now" : "Early"}</span>
      </button>
      <StepList steps={session.steps} />
      <div className="sticky-cta">
        <button type="button" className={`btn btn--primary btn--lg btn--block ${am ? "" : "btn--on-dusk"}`} onClick={onComplete} disabled={busy} aria-busy={busy || undefined}>
          {busy ? <span className="spinner" aria-hidden /> : null}
          Mark {am ? "morning" : "evening"} done
        </button>
      </div>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------- Friend pair
export const MEMBER_TODAY_TEXT: Record<MemberToday, string> = {
  done: "done today",
  rest_done: "rest day done",
  not_yet: "not done yet",
  no_rota: "no rota today",
};

export function FriendPair({ friend, myDayComplete, onNudge }: { friend: FriendSummary; myDayComplete: boolean; onNudge: () => void }) {
  return (
    <div className="friend-pair">
      <Avatar name={friend.displayName} size="sm" variant="friend" />
      <div className="grow">
        <div className="t-strong" style={{ fontSize: 14 }}>
          {friend.displayName} · {MEMBER_TODAY_TEXT[friend.today]}
        </div>
        <div className="t-small t-muted">
          Friend Streak {friend.friendStreak} · {myDayComplete ? "your side is done" : "grows when you both finish"}
        </div>
      </div>
      <button type="button" className="btn" onClick={onNudge}>Nudge</button>
    </div>
  );
}

// ---------------------------------------------------------------- Safety flag
export function SafetyFlagCard({ flag, productName, demo }: { flag: SafetyFlag; productName?: string; demo?: boolean }) {
  const alert = flag.kind === "regulatory_alert";
  const reviewers = flag.reviewers.map((r) => `${r.role === "pharmacist" ? "Pharmacist" : "Dermatologist"} ${r.name}, ${new Date(r.reviewedAt).toLocaleDateString()}`).join("; ");
  return (
    <article className={`safety ${alert ? "safety--alert" : ""}`} aria-label={alert ? "Independent regulator alert" : "Label-declared ingredient note"}>
      <span className="safety__tag">{alert ? "Independent alert" : "Label declares"}</span>
      <div className="t-strong" style={{ fontSize: 16, lineHeight: 1.3 }}>
        {productName ? `${productName}: ${flag.title.charAt(0).toLowerCase()}${flag.title.slice(1)}` : flag.title}
      </div>
      <p className="t-body">{flag.body}</p>
      <div className="safety__src">
        {alert && flag.notice ? (
          <>
            Source · {flag.notice.regulator}, notice {flag.notice.reference} ·{" "}
            <a href={flag.notice.url} target="_blank" rel="noreferrer">Read the official notice</a>
            <br />
          </>
        ) : null}
        Rule {flag.ruleId} · {/^\d/.test(flag.ruleVersion) ? `v${flag.ruleVersion}` : flag.ruleVersion} · {reviewers || (demo ? "Demo fixture · copy pending pharmacist review" : "Pending review")}
      </div>
    </article>
  );
}

// ---------------------------------------------------------------- Shelf Check / insight
export function ShelfCheck({ items, title = "Shelf Check" }: { items: ShelfObservation[]; title?: string }) {
  if (!items.length) return null;
  return (
    <section className="insight" aria-label={title}>
      <div className="row" style={{ ["--gap" as string]: "8px", marginBottom: 6 }}>
        <RotaMarker icon="shelf" size={26} mode="colour" ink={COLOR.porcelain} paper={COLOR.lagoon} accent={COLOR.seaGlass} />
        <span className="t-kicker">{title}</span>
      </div>
      <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {items.slice(0, 3).map((o, i) => (
          <li key={o.id} className={`insight__item ${o.tone === "unknown" ? "insight__item--unknown" : ""}`}>
            <span className="insight__n">{String(i + 1).padStart(2, "0")}</span>
            <span>{o.text}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

// ---------------------------------------------------------------- Provenance
export function provenanceTone(p: Pick<ShelfProduct, "inciStatus" | "identityStatus">): "good" | "mid" | "low" {
  if (p.inciStatus === "verified") return "good";
  if (p.inciStatus === "user_confirmed" || p.inciStatus === "corrected") return "mid";
  return "low";
}

export function ProvenanceLine({ product }: { product: ShelfProduct }) {
  const tone = provenanceTone(product);
  return (
    <div className="t-small t-strong" style={{ color: tone === "good" ? COLOR.seaGlassInk : tone === "mid" ? COLOR.ebony : COLOR.umber, marginTop: 2 }}>
      {PROVENANCE_LABEL[product.inciStatus]}
    </div>
  );
}

export function ProductTile({ category, unknown, large }: { category: ProductCategory; unknown?: boolean; large?: boolean }) {
  return (
    <span className={`tile ${unknown ? "tile--unknown" : ""} ${large ? "tile--lg" : ""}`}>
      <RotaMarker icon={unknown ? "jar" : CATEGORY_ICON[category]} size={large ? 36 : 28} />
    </span>
  );
}

/** Reveal preview: treatment days take a skin tone, lighter days Sea glass. */
export function previewTones(rota: Pick<RotaSnapshot, "days">) {
  return rota.days.map((d, i) => (d.type === "treatment" ? DONE_TONES[i] : COLOR.seaGlass));
}
