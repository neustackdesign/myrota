"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { RotaMarker } from "@/components/brand/RotaMarker";
import { RotaRing } from "@/components/brand/RotaRing";
import { FriendPair, RingDisc, segmentsFor, SessionCard, StreakCentre, streakAria, WeekStrip } from "@/components/rota/parts";
import { ShareSheet } from "@/components/sheets/ShareSheet";
import { ClaimSheet, InstallSheet, InviteSheet, NameSheet, NudgeSheet, ProfileSheet } from "@/components/sheets/social";
import { DaySheet, RescueSheet, SwapSheet } from "@/components/sheets/today";
import { Avatar, Button, ErrorBlock, InlineError, LoadingBlock, TabBar, useToast } from "@/components/ui/primitives";
import type { TodayResponse } from "@/lib/api/contract";
import { isStandalone } from "@/lib/client/pwa";
import { newIdempotencyKey, useRepository, useResource } from "@/lib/client/runtime";
import { shortLabel, skincareDateAt, weekdayOf } from "@/lib/domain/skincare-day";
import { buildTodayView, type TodayView } from "@/lib/domain/today";
import type { CompletionSession, DayRecord } from "@/lib/domain/types";
import { COLOR } from "@/lib/ui/ring";

type SheetName = "profile" | "rescue" | "swap" | "day" | "nudge" | "invite" | "name" | "claim" | "install" | "share3" | null;

function useClock(data: TodayResponse | undefined) {
  const fetchedAt = useRef(Date.now());
  const [tick, setTick] = useState(0);
  useEffect(() => {
    fetchedAt.current = Date.now();
  }, [data?.serverNow]);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);
  // Server time + elapsed, so a wrong device clock can't move the skincare day.
  return useMemo(() => (data ? new Date(Date.parse(data.serverNow) + (Date.now() - fetchedAt.current)) : new Date()), [data, tick]); // eslint-disable-line react-hooks/exhaustive-deps
}

function todayLine(v: TodayView) {
  const { am, pm } = v.sessions;
  if (v.dayComplete) return "Today's done. See you tomorrow morning.";
  if (v.rest) return "A rest day. Nothing to apply.";
  if (am && !pm) return am.done ? "" : "One session today, in the morning.";
  if (!am && pm) return "One session today, in the evening.";
  if (am?.done) return v.atmosphere === "pm" ? "Morning done. Evening is ready." : "Morning done. Evening from 8pm.";
  if (pm?.done) return "Evening done. Morning is still open.";
  return "Two sessions today. Start with the morning.";
}

function TodayScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const repo = useRepository();
  const toast = useToast();
  const today = useResource((r) => r.today());
  const me = useResource((r) => r.me());
  const config = useResource((r) => r.config().catch(() => null));
  const reminders = useResource((r) => r.reminders().catch(() => null));
  const now = useClock(today.data);
  const [sheet, setSheet] = useState<SheetName>(null);
  const [dayIdx, setDayIdx] = useState(0);
  const [openOverride, setOpenOverride] = useState<{ am?: boolean; pm?: boolean }>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [pop, setPop] = useState(false);
  const [fillIndex, setFillIndex] = useState<number | null>(null);
  const [celebrate, setCelebrate] = useState<null | { kind: "first" | "day3"; dayNumber: number }>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [afterName, setAfterName] = useState<SheetName>(null);
  const keys = useRef(new Map<string, string>());
  const keyFor = (k: string) => {
    if (!keys.current.has(k)) keys.current.set(k, newIdempotencyKey(k));
    return keys.current.get(k)!;
  };

  useEffect(() => {
    if (params.get("start") === "1") toast("Day 1. Your streak starts today.");
    if (params.get("claim")) setSheet("claim");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const view = useMemo(() => {
    const d = today.data;
    if (!d?.rota) return null;
    const rotas = d.rotas.length ? d.rotas : [d.rota];
    const date = skincareDateAt(now, d.timeZone);
    // Next week already planned from tomorrow: today still belongs to the previous rota.
    const covering = rotas.find((r) => r.days.some((day) => day.skincareDate === date)) ?? d.rota;
    return buildTodayView({ rota: covering, rotas, records: d.records, now, timeZone: d.timeZone });
  }, [today.data, now]);

  if (today.loading && !today.data) {
    return <Frame><div className="pad top-pad"><LoadingBlock label="Loading today" /></div></Frame>;
  }
  if (today.error) {
    return <Frame><div className="pad top-pad"><ErrorBlock error={today.error} onRetry={today.reload} title="We couldn't load today" /></div></Frame>;
  }
  if (!view) {
    return (
      <Frame>
        <div className="pad top-pad stack">
          <h1 className="t-display t-h1">No rota yet</h1>
          <p className="t-body t-muted">Add what's on your shelf and we'll plan your week. One product is enough to start.</p>
          <Link className="btn btn--primary btn--lg btn--block" href="/build">Add my products</Link>
        </div>
      </Frame>
    );
  }

  const data = today.data!;
  const pm = view.atmosphere === "pm";
  const friend = data.friends[0] ?? null;
  const guest = !me.data || me.data.isAnonymous;
  const segs = segmentsFor(view.week, view.dayIndex);

  const applyRecord = (record: DayRecord) =>
    today.setData((prev) => ({ ...prev!, records: [...prev!.records.filter((r) => !(r.rotaId === record.rotaId && r.skincareDate === record.skincareDate)), record] }));

  const complete = async (session: CompletionSession) => {
    if (!view.day) return;
    setBusy(session);
    setError(null);
    const wasComplete = view.dayComplete;
    try {
      const res = await repo.complete({ rotaId: view.rota.id, skincareDate: view.skincareDate, session, idempotencyKey: keyFor(`${view.skincareDate}:${session}`) });
      applyRecord(res.record);
      setOpenOverride({});
      toast(session === "am" ? "Morning done" : session === "pm" ? "Evening done" : "Rest day done");
      const next = buildTodayView({ rota: view.rota, rotas: data.rotas.length ? data.rotas : [view.rota], records: [...data.records.filter((r) => !(r.rotaId === res.record.rotaId && r.skincareDate === res.record.skincareDate)), res.record], now, timeZone: data.timeZone });
      if (next.dayComplete && !wasComplete) {
        setPop(true);
        setFillIndex(view.dayIndex);
        setTimeout(() => setPop(false), 450);
        // Reward delay: let the toast and segment land first.
        setTimeout(() => {
          if (view.dayIndex === 6) router.push("/week/complete");
          else if (next.streak.continuity === 1 && next.streak.earned === 1) setCelebrate({ kind: "first", dayNumber: view.dayIndex + 1 });
          else if (next.streak.continuity === 3) setCelebrate({ kind: "day3", dayNumber: view.dayIndex + 1 });
          else toast(`Today's done · ${next.streak.continuity}-day streak`);
        }, 900);
      }
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  };

  const offer = view.rescueOffer;
  const offerInPrev = !!offer && offer.rotaId !== view.rota.id;
  const missedLabel = offer ? `${offerInPrev ? "Last week's " : ""}${weekdayOf(offer.skincareDate)} was missed` : "";
  const unrescuable = view.unrescuable.filter((m) => Date.now() - Date.parse(m.expiresAt) < 7 * 86_400_000).at(-1);
  const amOpen = !!view.sessions.am && !view.sessions.am.done && (openOverride.am ?? !pm);
  const pmOpen = !!view.sessions.pm && !view.sessions.pm.done && (openOverride.pm ?? (pm || !view.sessions.am || view.sessions.am.done));
  const treatmentPm = view.day?.type === "treatment" ? view.day.pm.find((s) => s.activeClass)?.displayName ?? "treatment" : "treatment";

  return (
    <Frame pm={pm}>
      <header className={`today-head ${pm ? "on-dark" : ""}`}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <div className="t-note t-strong" style={{ color: pm ? "#BFE4DD" : COLOR.umber }}>{view.dayIndex >= 0 ? `Day ${view.dayIndex + 1} of 7` : "Week ended"}</div>
            <h1 className="t-display" style={{ fontSize: 26, lineHeight: 1.1 }}>{weekdayOf(view.skincareDate)} {shortLabel(view.skincareDate)}</h1>
          </div>
          <Avatar name={me.data?.displayName ?? null} onClick={() => setSheet("profile")} label="Open profile" />
        </div>
        <div className="row" style={{ marginTop: 18, ["--gap" as string]: "16px", alignItems: "center" }}>
          <RingDisc segments={segs} centre={<StreakCentre streak={view.streak} />} label={streakAria(view.streak)} pop={pop} fillIndex={fillIndex} />
          <div className="grow stack" style={{ ["--gap" as string]: "12px" }}>
            <WeekStrip week={view.week} todayIndex={view.dayIndex} dark={pm} onOpen={(i) => { setDayIdx(i); setSheet("day"); }} />
            <div className="t-note">{todayLine(view)}</div>
            {view.streak.rescued ? <div className="t-small" style={{ color: pm ? "#BFE4DD" : COLOR.umber }}>{view.streak.earned} earned · {view.streak.rescued} rescued</div> : null}
          </div>
        </div>
        {friend ? <FriendPair friend={friend} myDayComplete={view.dayComplete} onNudge={() => setSheet("nudge")} /> : null}
      </header>

      <div className="pad stack" style={{ padding: "20px 16px 32px", ["--gap" as string]: "14px" }}>
        {view.lateNight && view.sessions.pm && !view.sessions.pm.done ? (
          <div className="banner banner--late">
            <RotaMarker icon="pm" size={30} mode="colour" accent={COLOR.seaGlass} />
            <span><b>It's past midnight.</b> Your evening still counts for {weekdayOf(view.skincareDate)} until 4am.</span>
          </div>
        ) : null}
        {offer ? (
          <button type="button" className="banner banner--rescue" onClick={() => setSheet("rescue")}>
            <RotaMarker icon="rescue" size={36} mode="colour" accent={COLOR.porcelain} />
            <div className="grow">
              <div className="t-strong">{missedLabel}</div>
              <div className="t-small">Your Rota Rescue can keep the streak until {new Date(offer.expiresAt).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}. Today is unchanged.</div>
            </div>
            <span className="t-strong" style={{ fontSize: 13 }}>Rescue</span>
          </button>
        ) : null}
        {!offer && (info || unrescuable) ? (
          <div className={`banner ${unrescuable && !info ? "banner--expired" : "banner--info"}`}>
            <div className="grow">
              <div className="t-strong">{info ? "Streak restarts today" : unrescuable!.status === "expired" ? `${weekdayOf(unrescuable!.skincareDate)}'s Rescue has expired` : `${weekdayOf(unrescuable!.skincareDate)} can't be rescued`}</div>
              <div className="t-small t-muted" style={{ marginTop: 2 }}>
                {info ??
                  (unrescuable!.status === "expired"
                    ? `The 48 hours to rescue it ended ${new Date(unrescuable!.expiresAt).toLocaleString([], { weekday: "long", hour: "numeric", minute: "2-digit" })}. Today's plan hasn't changed.`
                    : "This rota's Rescue is already used. Today's plan hasn't changed.")}
              </div>
            </div>
            {info ? <button type="button" className="btn btn--text" onClick={() => setInfo(null)}>OK</button> : null}
          </div>
        ) : null}
        {data.rota && data.rota.id !== view.rota.id && data.rota.startDate > view.skincareDate ? (
          <div className="banner banner--recovery" role="status">
            <RotaMarker icon="rota" size={28} mode="colour" />
            <span><b>Week {data.rota.weekNumber} is planned.</b> It starts {weekdayOf(data.rota.startDate)} from the same shelf, with a new Rescue.</span>
          </div>
        ) : null}
        {view.dayComplete && !offer ? (
          <div className="banner banner--done">
            <RotaMarker icon="done" size={34} mode="colour" accent={COLOR.seaGlass} />
            <div><div className="t-strong" style={{ fontSize: 15 }}>Today's done</div><div className="t-note">{view.streak.continuity}-day streak. See you tomorrow morning.</div></div>
          </div>
        ) : null}
        {view.day?.type === "recovery" && view.sessions.pm && !view.sessions.pm.done ? (
          <div className="banner banner--recovery">
            <RotaMarker icon="water" size={28} mode="colour" accent={COLOR.seaGlass} />
            <span><b>Recovery {view.day.swappedToRecovery ? "night, by your choice" : "night"}.</b> Your stronger treatments are resting. It counts like any other day.</span>
          </div>
        ) : null}
        <InlineError error={error} />

        {view.rest ? (
          view.rest.done ? (
            <div className="session-row session-row--done">
              <RotaMarker icon="done" size={32} mode="colour" accent={COLOR.seaGlass} />
              <div><div className="t-strong" style={{ fontSize: 15 }}>Rest day done</div><div className="t-small t-ink-link">Checked in{view.rest.doneAt ? ` at ${new Date(view.rest.doneAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : ""}</div></div>
            </div>
          ) : (
            <section className="session session--rest" aria-label="Rest day">
              <div className="row" style={{ ["--gap" as string]: "12px" }}>
                <RotaMarker icon="water" size={34} mode="colour" accent={COLOR.seaGlass} />
                <div className="grow"><div className="t-display t-h3">Rest day</div><div className="t-note" style={{ marginTop: 4 }}>Nothing scheduled today. That's the plan. One check-in keeps your streak.</div></div>
              </div>
              <Button variant="rescue" busy={busy === "rest"} onClick={() => complete("rest")}>Rest day done</Button>
            </section>
          )
        ) : null}

        {view.sessions.am ? (
          <SessionCard
            session={view.sessions.am}
            open={amOpen}
            current={!pm}
            onToggle={() => setOpenOverride((o) => ({ ...o, am: !amOpen }))}
            onComplete={() => complete("am")}
            busy={busy === "am"}
            meta={`${view.sessions.am.steps.length} step${view.sessions.am.steps.length === 1 ? "" : "s"}${pm ? " · open till 4am" : ""}`}
          />
        ) : null}
        {view.sessions.pm ? (
          <SessionCard
            session={view.sessions.pm}
            open={pmOpen}
            current={pm}
            onToggle={() => setOpenOverride((o) => ({ ...o, pm: !pmOpen }))}
            onComplete={() => complete("pm")}
            busy={busy === "pm"}
            meta={`${view.sessions.pm.steps.length} step${view.sessions.pm.steps.length === 1 ? "" : "s"}${view.day?.type === "recovery" ? " · recovery" : view.day?.type === "treatment" ? ` · ${treatmentPm}` : ""}${pm ? "" : " · from 8pm"}`}
          >
            {view.canSwap ? (
              <button type="button" className="btn btn--text" onClick={() => setSheet("swap")}>Swap tonight to recovery</button>
            ) : null}
          </SessionCard>
        ) : null}
        {view.sessions.am && !view.sessions.pm && !view.rest ? <p className="t-note t-muted" style={{ padding: "0 4px" }}>No evening steps with your current shelf. Today is complete once the morning is done.</p> : null}
        {view.dayIndex < 0 ? (
          <div className="state-block">
            <b>This rota has ended</b>
            <p className="t-note t-muted">See how the week went and plan the next one from the same shelf.</p>
            <Link className="btn btn--primary btn--lg btn--block" href="/week/complete">See my week</Link>
          </div>
        ) : null}

        {view.dayComplete && !data.friends.length && !offer ? (
          <div className="invite-card">
            <div className="grow">
              <div className="t-display" style={{ fontSize: 20, lineHeight: 1.15 }}>Streaks are easier in pairs.</div>
              <div className="t-note" style={{ marginTop: 6 }}>They build their own rota. You see each other's streak, never products.</div>
            </div>
            <button type="button" className="btn btn--primary" onClick={() => (me.data?.displayName ? setSheet("invite") : (setAfterName("invite"), setSheet("name")))}>Invite</button>
          </div>
        ) : null}
        {guest && view.streak.continuity >= 1 && view.dayIndex >= 1 && !offer ? (
          <div className="banner banner--claim">
            <RotaMarker icon="profile" size={32} mode="colour" accent={COLOR.sand} />
            <div className="grow">
              <div className="t-strong">Your {view.streak.continuity}-day streak lives on this phone only.</div>
              <div className="t-note t-muted">Save it in 20 seconds. Optional.</div>
            </div>
            <button type="button" className="btn" onClick={() => setSheet("claim")}>Save</button>
          </div>
        ) : null}
      </div>

      {celebrate ? (
        <Celebration
          view={view}
          kind={celebrate.kind}
          dayNumber={celebrate.dayNumber}
          segs={segs}
          hasFriends={!!data.friends.length}
          onInvite={() => { setCelebrate(null); if (me.data?.displayName) setSheet("invite"); else { setAfterName("invite"); setSheet("name"); } }}
          onShare={() => { setCelebrate(null); setSheet("share3"); }}
          onBack={() => { setCelebrate(null); if (!isStandalone()) setTimeout(() => setSheet("install"), 400); }}
        />
      ) : null}

      <ProfileSheet
        open={sheet === "profile"}
        onClose={() => setSheet(null)}
        me={me.data ?? null}
        rotaLine={`Day ${view.dayIndex + 1} of 7 · Rescue ${view.rota.rescueUsedFor ? "used" : "available"}`}
        remindersLine={reminders.data?.enabled ? `${reminders.data.am} · ${reminders.data.pm}` : "Off"}
        onEditName={() => setSheet("name")}
        onClaim={() => setSheet("claim")}
        onInstall={() => setSheet("install")}
      />
      <RescueSheet
        open={sheet === "rescue"}
        onClose={() => setSheet(null)}
        miss={offer}
        preview={view.rescuePreview}
        week={view.week}
        todayIndex={view.dayIndex}
        inPreviousRota={offerInPrev}
        busy={busy === "rescue" ? "rescue" : busy === "letgo" ? "letgo" : null}
        error={error}
        onRescue={async () => {
          if (!offer) return;
          setBusy("rescue");
          setError(null);
          try {
            const res = await repo.rescue(offer.rotaId, { missedSkincareDate: offer.skincareDate, idempotencyKey: keyFor(`rescue:${offer.skincareDate}`) });
            today.setData((prev) => ({
              ...prev!,
              rota: prev!.rota?.id === res.rota.id ? res.rota : prev!.rota,
              rotas: prev!.rotas.map((r) => (r.id === res.rota.id ? res.rota : r)),
              records: [...prev!.records.filter((r) => !(r.rotaId === res.record.rotaId && r.skincareDate === res.record.skincareDate)), res.record],
            }));
            setSheet(null);
            setPop(true);
            setTimeout(() => setPop(false), 450);
            toast("Rescued. Your streak carries on.");
          } catch (e) {
            setError(e);
          } finally {
            setBusy(null);
          }
        }}
        onLetGo={async () => {
          if (!offer) return;
          setBusy("letgo");
          setError(null);
          try {
            await repo.declineRescue(offer.rotaId, { missedSkincareDate: offer.skincareDate, idempotencyKey: keyFor(`decline:${offer.skincareDate}`) });
            setSheet(null);
            setInfo(`You let ${weekdayOf(offer.skincareDate)} go. Your rota carries on exactly as planned. Nothing doubles up.`);
            today.reload();
          } catch (e) {
            setError(e);
          } finally {
            setBusy(null);
          }
        }}
      />
      <SwapSheet
        open={sheet === "swap"}
        onClose={() => setSheet(null)}
        what={treatmentPm}
        busy={busy === "swap"}
        error={error}
        onSwap={async () => {
          setBusy("swap");
          setError(null);
          try {
            const res = await repo.swapRecovery(view.rota.id, { skincareDate: view.skincareDate, idempotencyKey: keyFor(`swap:${view.skincareDate}`) });
            today.setData((prev) => ({ ...prev!, rota: res.rota, rotas: prev!.rotas.map((r) => (r.id === res.rota.id ? res.rota : r)) }));
            setSheet(null);
            toast("Tonight is a recovery night");
          } catch (e) {
            setError(e);
          } finally {
            setBusy(null);
          }
        }}
      />
      <DaySheet open={sheet === "day"} onClose={() => setSheet(null)} day={view.week[dayIdx] ?? null} />
      {friend ? <NudgeSheet open={sheet === "nudge"} onClose={() => setSheet(null)} friendName={friend.displayName} pairStreak={friend.friendStreak} myDayComplete={view.dayComplete} /> : null}
      <NameSheet
        open={sheet === "name"}
        onClose={() => setSheet(null)}
        initial={me.data?.displayName ?? null}
        onSaved={(name) => {
          me.setData((m) => (m ? { ...m, displayName: name } : { userId: "", isAnonymous: true, displayName: name, identityProviders: [], hasRota: true }));
          setSheet(afterName);
          setAfterName(null);
        }}
      />
      <InviteSheet open={sheet === "invite"} onClose={() => setSheet(null)} streak={view.streak.continuity} />
      <ClaimSheet open={sheet === "claim"} onClose={() => { setSheet(null); me.reload(); }} streak={view.streak.continuity} config={config.data ?? null} returning={!!params.get("claim")} />
      <InstallSheet open={sheet === "install"} onClose={() => setSheet(null)} onSaveFirst={() => setSheet("claim")} isGuest={guest} />
      <ShareSheet key={sheet === "share3" ? "s3" : "x"} open={sheet === "share3"} onClose={() => setSheet(null)} input={{ kind: "day3", streak: view.streak.continuity }} />
    </Frame>
  );
}

function Frame({ children, pm }: { children: React.ReactNode; pm?: boolean }) {
  return (
    <div className={`app-frame has-tabbar ${pm ? "app-frame--pm today--pm" : "app-frame--pearl"}`}>
      <main id="main" className="app-main">{children}</main>
      <TabBar />
    </div>
  );
}

function Celebration({
  view,
  kind,
  dayNumber,
  segs,
  hasFriends,
  onInvite,
  onShare,
  onBack,
}: {
  view: TodayView;
  kind: "first" | "day3";
  dayNumber: number;
  segs: ReturnType<typeof segmentsFor>;
  hasFriends: boolean;
  onInvite: () => void;
  onShare: () => void;
  onBack: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => ref.current?.focus(), []);
  const restish = view.day?.type !== "treatment";
  return (
    <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="celebrate-title" className="grain grain--sunrise screen-enter" style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", justifyContent: "center" }}>
      <div className="stack center" style={{ width: "100%", maxWidth: 520, justifyContent: "space-between", padding: "calc(56px + env(safe-area-inset-top)) 24px calc(24px + env(safe-area-inset-bottom))" }}>
        <span className="t-kicker">Day {dayNumber} of 7</span>
        <div className="ring-disc" style={{ width: 240, height: 240 }}>
          <RotaRing segments={segs} size={220} strokeWidth={11} />
          <div className="ring-centre ring-num--pop">
            <div className="ring-num" style={{ fontSize: 86 }}>{view.streak.continuity}</div>
            <div className="ring-label">day streak</div>
          </div>
        </div>
        <div>
          <h2 id="celebrate-title" className="t-display" style={{ fontSize: 38 }}>{kind === "day3" ? "Three days in a row." : `Day ${dayNumber} done.`}</h2>
          <p className="t-body" style={{ marginTop: 8 }}>{restish ? "A lighter day, kept. It counts like any other." : "Every session today. That's how a streak grows."}</p>
        </div>
        <div className="stack" style={{ width: "100%" }}>
          {kind === "day3" ? <Button variant="primary" icon="share" onClick={onShare}>Share your 3-day streak</Button> : !hasFriends ? <Button variant="primary" icon="share" onClick={onInvite}>Invite a friend on WhatsApp</Button> : null}
          <Button variant={kind === "first" && hasFriends ? "primary" : "secondary"} onClick={onBack}>Back to today</Button>
        </div>
      </div>
    </div>
  );
}

export default function TodayPage() {
  return (
    <Suspense fallback={null}>
      <TodayScreen />
    </Suspense>
  );
}
