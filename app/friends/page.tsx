"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { RotaMarker } from "@/components/brand/RotaMarker";
import { MEMBER_TODAY_TEXT } from "@/components/rota/parts";
import { ShareSheet } from "@/components/sheets/ShareSheet";
import { InviteSheet, NameSheet, NudgeSheet } from "@/components/sheets/social";
import { Avatar, Button, ErrorBlock, LoadingBlock, TabBar } from "@/components/ui/primitives";
import type { FriendSummary } from "@/lib/api/contract";
import { useRepository, useResource } from "@/lib/client/runtime";
import { computeStreak, qualifies } from "@/lib/domain/records";
import { skincareDateAt } from "@/lib/domain/skincare-day";
import { COLOR } from "@/lib/ui/ring";

export default function FriendsPage() {
  const router = useRouter();
  const repo = useRepository();
  const friends = useResource((r) => r.friends());
  const me = useResource((r) => r.me());
  const today = useResource((r) => r.today());
  const [sheet, setSheet] = useState<"invite" | "name" | "nudge" | "share" | null>(null);
  const [target, setTarget] = useState<FriendSummary | null>(null);
  const [invited, setInvited] = useState(false);
  const joined = friends.data?.friends.find((f) => f.newlyJoined) ?? null;

  const myDayComplete = (() => {
    const d = today.data;
    if (!d?.rota) return false;
    const date = skincareDateAt(new Date(d.serverNow), d.timeZone);
    const rec = d.records.find((r) => r.rotaId === d.rota!.id && r.skincareDate === date);
    return !!rec && qualifies(rec);
  })();
  const streak = today.data?.rota
    ? computeStreak({ records: today.data.records, rotas: today.data.rotas.length ? today.data.rotas : [today.data.rota], now: today.data.serverNow, timeZone: today.data.timeZone }).continuity
    : 0;

  const openInvite = () => (me.data?.displayName ? setSheet("invite") : setSheet("name"));
  const list = friends.data?.friends ?? [];
  const head = invited ? "Invite sent. Waiting for them to build a rota." : list.length ? "Invite one more" : "Streaks are easier in pairs.";

  return (
    <div className="app-frame app-frame--pearl has-tabbar">
      <main id="main" className="app-main">
        <div className="pad top-pad" style={{ paddingBottom: 12 }}>
          <h1 className="t-display" style={{ fontSize: 32, lineHeight: 1 }}>Friends</h1>
          <p className="t-note t-muted" style={{ marginTop: 6 }}>Everyone keeps their own rota. Friends see streaks, never products.</p>
        </div>
        <div className="pad stack" style={{ ["--gap" as string]: "10px" }}>
          {friends.loading && !friends.data ? <LoadingBlock lines={2} label="Loading friends" /> : null}
          {friends.error ? <ErrorBlock error={friends.error} onRetry={friends.reload} title="We couldn't load your friends" /> : null}
          {list.map((f, i) => (
            <article key={f.pairId} className="card row" style={{ ["--gap" as string]: "12px", alignItems: "center" }} aria-label={`${f.displayName}, Friend Streak ${f.friendStreak}`}>
              <Avatar name={f.displayName} variant={i % 2 ? "friend-2" : "friend"} />
              <div className="grow">
                <div className="t-strong" style={{ fontSize: 15 }}>{f.displayName}</div>
                <div className="t-small t-muted">{MEMBER_TODAY_TEXT[f.today]} · {f.pairTodayCounted ? "you both finished today" : "Friend Streak grows when you both finish"}</div>
                <div className="row" style={{ marginTop: 6, ["--gap" as string]: "6px", flexWrap: "wrap" }}>
                  <button type="button" className="btn" onClick={() => { setTarget(f); setSheet("nudge"); }}>Nudge on WhatsApp</button>
                  <button type="button" className="btn btn--text" onClick={() => { setTarget(f); setSheet("share"); }}>Share</button>
                </div>
              </div>
              <div className="ring-disc" style={{ width: 62, height: 62 }}>
                <div className="ring-centre">
                  <div className="ring-num" style={{ fontSize: 22 }}>{f.friendStreak}</div>
                  <div className="ring-label" style={{ fontSize: 9 }}>together</div>
                </div>
              </div>
            </article>
          ))}
        </div>
        <section className="grain grain--skin" style={{ margin: "14px 16px 24px", borderRadius: 24, padding: "28px 18px 18px" }} aria-labelledby="invite-head">
          <div className="stack" style={{ ["--gap" as string]: "10px" }}>
            <div style={{ display: "flex", justifyContent: "center", padding: "8px 0 18px" }}>
              <RotaMarker icon="friends" size={110} mode="colour" accent={COLOR.sand} />
            </div>
            <h2 id="invite-head" className="t-display" style={{ fontSize: 24 }}>{head}</h2>
            <p className="plate t-note" style={{ margin: 0 }}>One link works for a chat, a group or your Status. Everyone who joins builds their own rota from one product or more. You see each other's streak, never products.</p>
            <Button variant="primary" icon="share" onClick={openInvite}>Invite on WhatsApp</Button>
          </div>
        </section>
      </main>
      <TabBar />

      {joined ? (
        <FriendJoined
          friend={joined}
          myName={me.data?.displayName ?? null}
          onHi={() => { setTarget(joined); setSheet("nudge"); void repo.markFriendSeen(joined.pairId).then(friends.reload); }}
          onBack={() => { void repo.markFriendSeen(joined.pairId).then(friends.reload); router.push("/today"); }}
        />
      ) : null}

      <NameSheet open={sheet === "name"} onClose={() => setSheet(null)} initial={me.data?.displayName ?? null} onSaved={(name) => { me.setData((m) => (m ? { ...m, displayName: name } : m!)); setSheet("invite"); }} />
      <InviteSheet open={sheet === "invite"} onClose={() => setSheet(null)} streak={streak} onSent={() => setInvited(true)} />
      {target ? <NudgeSheet open={sheet === "nudge"} onClose={() => setSheet(null)} friendName={target.displayName} pairStreak={target.friendStreak} myDayComplete={myDayComplete} /> : null}
      {target ? (
        <ShareSheet
          key={`share-${target.pairId}-${sheet}`}
          open={sheet === "share"}
          onClose={() => setSheet(null)}
          input={{ kind: "friend", pairStreak: target.friendStreak, myName: me.data?.displayName ?? null, friendName: target.displayName, inviteToken: friends.data?.inviteToken ?? null }}
        />
      ) : null}
    </div>
  );
}

function FriendJoined({ friend, myName, onHi, onBack }: { friend: FriendSummary; myName: string | null; onHi: () => void; onBack: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="joined-title" className="grain grain--skin screen-enter" style={{ position: "fixed", inset: 0, zIndex: 45, display: "flex", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 520, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "calc(40px + env(safe-area-inset-top)) 20px calc(24px + env(safe-area-inset-bottom))" }}>
        <div style={{ display: "grid", placeItems: "center", flex: 1 }} aria-hidden>
          <RotaMarker icon="friends" size={180} mode="colour" accent={COLOR.sand} />
        </div>
        <div className="card stack" style={{ borderRadius: 26, padding: 20 }}>
          <div className="avatar-pair">
            <Avatar name={myName} size="lg" variant="friend" />
            <Avatar name={friend.displayName} size="lg" variant="friend-2" />
          </div>
          <h2 id="joined-title" className="t-display" style={{ fontSize: 30 }}>{friend.displayName} joined you.</h2>
          <p className="t-body">{friend.displayName} built a rota from their own shelf. Your Friend Streak starts on the first day you both finish, each by your own clock.</p>
          <Button variant="primary" icon="share" onClick={onHi}>Say hi on WhatsApp</Button>
          <Button onClick={onBack}>Back to Today</Button>
        </div>
      </div>
    </div>
  );
}
