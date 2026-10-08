"use client";

import { RotaMarker } from "@/components/brand/RotaMarker";
import { RotaRing } from "@/components/brand/RotaRing";
import { Button, InlineError, Sheet } from "@/components/ui/primitives";
import { CATEGORY_LABEL, DAY_TYPE_LABEL, segmentsFor } from "@/components/rota/parts";
import type { MissedDay, StreakSummary } from "@/lib/domain/records";
import { weekdayOf } from "@/lib/domain/skincare-day";
import type { WeekDayView } from "@/lib/domain/today";
import { COLOR, segmentFor } from "@/lib/ui/ring";

function deadline(iso: string) {
  return new Date(iso).toLocaleString([], { weekday: "long", hour: "numeric", minute: "2-digit" });
}

export function RescueSheet({
  open,
  onClose,
  miss,
  preview,
  week,
  todayIndex,
  inPreviousRota,
  onRescue,
  onLetGo,
  busy,
  error,
}: {
  open: boolean;
  onClose: () => void;
  miss: MissedDay | null;
  preview: StreakSummary | null;
  week: WeekDayView[];
  todayIndex: number;
  inPreviousRota: boolean;
  onRescue: () => void;
  onLetGo: () => void;
  busy: "rescue" | "letgo" | null;
  error: unknown;
}) {
  if (!miss || !preview) return null;
  const day = weekdayOf(miss.skincareDate);
  const segs = segmentsFor(week, todayIndex).map((s, i) => (week[i]?.skincareDate === miss.skincareDate ? segmentFor(i, "rescued", week[i].type, false) : s));
  return (
    <Sheet open={open} onClose={onClose} labelledBy="rescue-title">
      <div className="stack">
        <div className="row" style={{ ["--gap" as string]: "14px" }}>
          <div className="ring-disc" style={{ width: 96, height: 96 }} aria-hidden>
            <RotaRing segments={segs} size={88} strokeWidth={14} />
            <span className="ring-num" style={{ fontSize: 26 }}>{preview.continuity}</span>
          </div>
          <div>
            <div className="t-kicker t-ink-link">Rota Rescue · one per rota</div>
            <h2 id="rescue-title" className="t-display t-h3" style={{ fontSize: 24, marginTop: 2 }}>
              {inPreviousRota ? `Last week's ${day} was missed` : `${day} was missed`}
            </h2>
          </div>
        </div>
        <p className="t-body t-muted">
          Use {inPreviousRota ? "last week's" : "this rota's"} Rescue and {day} is marked rescued. Your streak carries on at {preview.continuity} days: {preview.earned} earned, {preview.rescued} rescued.
        </p>
        <div className="note note--dew">Today stays exactly as planned. Nothing is moved and nothing doubles up. A rescued day keeps your streak going but isn't counted as a completed day.</div>
        <p className="t-small t-muted">Available until {deadline(miss.expiresAt)}.</p>
        <InlineError error={error} />
        <Button variant="rescue" icon="rescue" iconMode="colour" busy={busy === "rescue"} onClick={onRescue}>Use Rota Rescue</Button>
        <Button variant="text-muted" busy={busy === "letgo"} onClick={onLetGo}>Let it go and restart my streak</Button>
      </div>
    </Sheet>
  );
}

export function SwapSheet({ open, onClose, what, onSwap, busy, error }: { open: boolean; onClose: () => void; what: string; onSwap: () => void; busy: boolean; error: unknown }) {
  return (
    <Sheet open={open} onClose={onClose} labelledBy="swap-title">
      <div className="stack">
        <h2 id="swap-title" className="t-display t-h2">Swap tonight to recovery?</h2>
        <p className="t-body t-muted">Your {what} rests tonight and the rest of the week stays as planned. Tonight still counts. This is your choice, separate from Rota Rescue, and it costs nothing.</p>
        <InlineError error={error} />
        <Button variant="rescue" busy={busy} onClick={onSwap}>Swap to recovery</Button>
        <Button onClick={onClose}>Keep tonight as planned</Button>
      </div>
    </Sheet>
  );
}

const DAY_STATUS: Record<string, { t: string; cls: string }> = {
  complete: { t: "Done", cls: "badge badge--good" },
  rest_complete: { t: "Rest done", cls: "badge badge--good" },
  rescued: { t: "Rescued", cls: "badge badge--good" },
  missed: { t: "Missed", cls: "badge badge--low" },
  in_progress: { t: "Today", cls: "badge badge--mid" },
  future: { t: "Planned", cls: "badge badge--mid" },
};

export function DaySheet({ open, onClose, day }: { open: boolean; onClose: () => void; day: WeekDayView | null }) {
  if (!day) return null;
  const st = DAY_STATUS[day.status];
  const rest = day.plan.am.length === 0 && day.plan.pm.length === 0;
  return (
    <Sheet open={open} onClose={onClose} labelledBy="day-title">
      <div className="stack">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
          <h2 id="day-title" className="t-display t-h2">{weekdayOf(day.skincareDate)}</h2>
          <span className={st.cls} style={day.status === "in_progress" ? { borderColor: COLOR.ember } : undefined}>{st.t}</span>
        </div>
        <span className="t-body t-muted">
          {DAY_TYPE_LABEL[day.type]}
          {day.swapped ? " · swapped to recovery by you" : ""}
        </span>
        {day.plan.am.length ? (
          <div className="card" style={{ background: COLOR.apricot }}>
            <div className="row t-strong" style={{ marginBottom: 6 }}><RotaMarker icon="am" size={22} mode="colour" accent={COLOR.ember} />Morning</div>
            <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7 }}>
              {day.plan.am.map((s, i) => <li key={i}>{s.displayName} <span className="t-small t-muted">· {s.analysed ? CATEGORY_LABEL[s.category] : "not analysed"}</span></li>)}
            </ol>
          </div>
        ) : null}
        {day.plan.pm.length ? (
          <div className="card card--dusk on-dark">
            <div className="row t-strong" style={{ marginBottom: 6 }}><RotaMarker icon="pm" size={22} mode="colour" ink={COLOR.porcelain} paper={COLOR.dusk} accent={COLOR.seaGlass} />Evening</div>
            <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7 }}>
              {day.plan.pm.map((s, i) => <li key={i}>{s.displayName} <span className="t-small" style={{ color: "#BFE4DD" }}>· {s.analysed ? CATEGORY_LABEL[s.category] : "not analysed"}</span></li>)}
            </ol>
          </div>
        ) : null}
        {rest ? <div className="note note--dew">Rest day. Nothing scheduled, one check-in.</div> : null}
        <Button onClick={onClose}>Close</Button>
      </div>
    </Sheet>
  );
}
