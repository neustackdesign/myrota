"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { RotaMarker } from "@/components/brand/RotaMarker";
import { ToneRing } from "@/components/brand/RotaRing";
import { Avatar, Button, InlineError, Sheet, useToast } from "@/components/ui/primitives";
import type { ClientConfigResponse, InviteResponse, MeResponse } from "@/lib/api/contract";
import { useRepository } from "@/lib/client/runtime";
import { absoluteUrl, canPromptInstall, copyText, detectPlatform, isStandalone, onInstallPromptChange, openWhatsApp, promptInstall, type Platform } from "@/lib/client/pwa";
import { COLOR, DONE_TONES } from "@/lib/ui/ring";

// ---------------------------------------------------------------- Display name
export function NameSheet({ open, onClose, initial, onSaved }: { open: boolean; onClose: () => void; initial: string | null; onSaved: (name: string) => void }) {
  const repo = useRepository();
  const [draft, setDraft] = useState(initial ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    if (open) setDraft(initial ?? "");
  }, [open, initial]);
  const ok = draft.trim().length > 0 && draft.trim().length <= 40;
  return (
    <Sheet open={open} onClose={onClose} labelledBy="name-title">
      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!ok) return;
          setBusy(true);
          setError(null);
          try {
            const me = await repo.updateDisplayName(draft.trim());
            onSaved(me.displayName ?? draft.trim());
          } catch (err) {
            setError(err);
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2 id="name-title" className="t-display t-h2">What should friends call you?</h2>
        <p className="t-body t-muted">Shown only to people who join from your link. You can change it in Profile.</p>
        <label className="field">
          <span className="sr-only">Display name</span>
          <input className="input" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="First name or nickname" autoComplete="nickname" maxLength={40} />
        </label>
        <InlineError error={error} />
        <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={!ok || busy} aria-busy={busy || undefined}>
          {busy ? <span className="spinner" aria-hidden /> : null}Continue
        </button>
      </form>
    </Sheet>
  );
}

// ---------------------------------------------------------------- Invite
export function inviteMessage(streak: number, url: string) {
  return `I'm on day ${Math.max(1, streak)} of my skin rota. Build your own from what you already have. Takes a minute.\n${url}`;
}

export function InviteSheet({ open, onClose, streak, onSent }: { open: boolean; onClose: () => void; streak: number; onSent?: () => void }) {
  const repo = useRepository();
  const toast = useToast();
  const [invite, setInvite] = useState<InviteResponse | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!open || invite) return;
    setLoading(true);
    setError(null);
    repo
      .createInvite()
      .then(setInvite)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [open, invite, repo]);
  const url = invite ? absoluteUrl(invite.url) : "";
  return (
    <Sheet open={open} onClose={onClose} labelledBy="invite-title">
      <div className="stack">
        <h2 id="invite-title" className="t-display t-h2">Invite a friend</h2>
        <p className="t-body t-muted">They build their own rota from their own shelf. You'll see each other's streak, nothing else. One link works for a chat, a group or your Status.</p>
        <div className="card card--shell" aria-live="polite">
          {loading ? (
            <div className="skeleton" style={{ height: 60 }} />
          ) : invite ? (
            <>
              <p className="t-body" style={{ whiteSpace: "pre-line" }}>{inviteMessage(streak, "").trim()}</p>
              <div className="t-strong t-ink-link" style={{ fontSize: 13, marginTop: 6, wordBreak: "break-all" }}>{url}</div>
            </>
          ) : (
            <InlineError error={error} />
          )}
        </div>
        <Button
          variant="primary"
          icon="share"
          disabled={!invite}
          onClick={() => {
            openWhatsApp(inviteMessage(streak, url));
            toast("WhatsApp opens. You pick the chat.");
            onSent?.();
            onClose();
          }}
        >
          Send on WhatsApp
        </Button>
        <Button
          disabled={!invite}
          onClick={async () => {
            const ok = await copyText(url);
            toast(ok ? "Link copied" : "Couldn't copy. Press and hold the link to copy it.");
          }}
        >
          Copy link
        </Button>
        {error && !loading ? <Button variant="text" onClick={() => setInvite(null)}>Try again</Button> : null}
      </div>
    </Sheet>
  );
}

// ---------------------------------------------------------------- Nudge
export function nudgeText(myDayComplete: boolean, pairStreak: number) {
  const link = absoluteUrl("/today");
  return myDayComplete
    ? `Finished my skincare for today. Your turn, our Friend Streak is on ${pairStreak} ${pairStreak === 1 ? "day" : "days"}. ${link}`
    : `Doing my skincare now. Join me? Our Friend Streak is on ${pairStreak} ${pairStreak === 1 ? "day" : "days"}. ${link}`;
}

export function NudgeSheet({ open, onClose, friendName, pairStreak, myDayComplete }: { open: boolean; onClose: () => void; friendName: string; pairStreak: number; myDayComplete: boolean }) {
  const toast = useToast();
  const text = nudgeText(myDayComplete, pairStreak);
  return (
    <Sheet open={open} onClose={onClose} labelledBy="nudge-title">
      <div className="stack">
        <h2 id="nudge-title" className="t-display t-h2">Nudge {friendName}</h2>
        <div style={{ alignSelf: "flex-start", maxWidth: 320, background: COLOR.shell, borderRadius: "16px 16px 16px 4px", padding: "12px 14px", fontSize: 15, lineHeight: 1.45 }}>{text}</div>
        <p className="t-body t-muted">WhatsApp opens with this message ready. You choose who to send it to. We don't have anyone's number.</p>
        <Button
          variant="primary"
          icon="share"
          onClick={() => {
            openWhatsApp(text);
            toast("WhatsApp opens. You pick the chat.");
            onClose();
          }}
        >
          Open WhatsApp
        </Button>
        <Button variant="text-muted" onClick={onClose}>Not now</Button>
      </div>
    </Sheet>
  );
}

// ---------------------------------------------------------------- Claim (Google first, email code second, Apple only if configured)
type ClaimStage = "choose" | "email" | "otp" | "pending" | "saved" | "failed";

export function ClaimSheet({ open, onClose, streak, config, returning = false }: { open: boolean; onClose: () => void; streak: number; config: ClientConfigResponse | null; returning?: boolean }) {
  const repo = useRepository();
  const [stage, setStage] = useState<ClaimStage>("choose");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [correlation, setCorrelation] = useState<string | null>(null);
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  useEffect(() => {
    if (!open) return;
    setError(null);
    setCode(["", "", "", "", "", ""]);
    if (returning) void confirmMerge();
    else setStage("choose");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, returning]);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  };

  const confirmMerge = async () => {
    setStage("pending");
    for (let i = 0; i < 10; i += 1) {
      try {
        const s = await repo.claimStatus();
        setCorrelation(s.correlationId);
        if (s.state === "committed") return setStage("saved");
        if (s.state === "failed") return setStage("failed");
      } catch (e) {
        setError(e);
        return setStage("failed");
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
    setStage("failed");
  };

  const emailOk = /^\S+@\S+\.\S+$/.test(email.trim());
  const codeStr = code.join("");
  const providers = config?.providers;
  return (
    <Sheet open={open} onClose={onClose} labelledBy="claim-title" dismissible={stage !== "pending"}>
      <div className="stack">
        <h2 id="claim-title" className="t-display t-h2">{stage === "saved" ? "Streak saved" : `Save your ${streak}-day streak`}</h2>
        {stage === "choose" ? (
          <>
            <p className="t-body t-muted">Right now it lives on this phone only. Save it and it follows you to a new phone. You can keep using myrota without saving.</p>
            {providers?.google !== false ? (
              <Button busy={busy === "google"} onClick={() => run("google", async () => { const { url } = await repo.startGoogleClaim("/today?claim=google"); window.location.assign(url); })}>
                Continue with Google
              </Button>
            ) : null}
            {providers?.emailOtp !== false ? <Button onClick={() => setStage("email")}>Continue with email</Button> : null}
            {/* Apple is FAST FOLLOW: no button at all until config.providers.apple is true AND the Apple flow is wired. Never an inert button. */}
            <p className="t-small t-muted center" style={{ textAlign: "center" }}>Only used to sign you in. Friends never see it.</p>
          </>
        ) : null}
        {stage === "email" ? (
          <form className="stack" onSubmit={(e) => { e.preventDefault(); if (emailOk) void run("send", async () => { await repo.sendEmailCode(email.trim(), name.trim() || null); setStage("otp"); }); }}>
            <label className="field">
              <span className="t-label">What friends call you</span>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="First name or nickname" autoComplete="nickname" maxLength={40} />
            </label>
            <label className="field">
              <span className="t-label">Email</span>
              <input className="input" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={email.length > 3 && !emailOk} />
            </label>
            <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={!emailOk || busy === "send"} aria-busy={busy === "send" || undefined}>
              {busy === "send" ? <span className="spinner" aria-hidden /> : null}Send a 6-digit code
            </button>
            <Button variant="text-muted" onClick={() => setStage("choose")}>Back</Button>
          </form>
        ) : null}
        {stage === "otp" ? (
          <form className="stack" onSubmit={(e) => { e.preventDefault(); if (codeStr.length === 6) void run("verify", async () => { await repo.verifyEmailCode(email.trim(), codeStr); await confirmMerge(); }); }}>
            <p className="t-body t-muted">We sent a 6-digit code to {email}. It expires in a few minutes.</p>
            <div className="otp" role="group" aria-label="6-digit code">
              {code.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => { boxes.current[i] = el; }}
                  value={d}
                  inputMode="numeric"
                  autoComplete={i === 0 ? "one-time-code" : "off"}
                  aria-label={`Digit ${i + 1}`}
                  maxLength={6}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "");
                    if (!digits) return setCode((c) => c.map((x, j) => (j === i ? "" : x)));
                    setCode((c) => {
                      const next = [...c];
                      digits.split("").slice(0, 6 - i).forEach((ch, k) => { next[i + k] = ch; });
                      return next;
                    });
                    boxes.current[Math.min(5, i + digits.length)]?.focus();
                  }}
                  onKeyDown={(e) => { if (e.key === "Backspace" && !code[i] && i > 0) boxes.current[i - 1]?.focus(); }}
                />
              ))}
            </div>
            <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={codeStr.length !== 6 || busy === "verify"} aria-busy={busy === "verify" || undefined}>
              {busy === "verify" ? <span className="spinner" aria-hidden /> : null}Verify
            </button>
            <Button variant="text-muted" busy={busy === "resend"} onClick={() => run("resend", () => repo.sendEmailCode(email.trim(), null))}>Send a new code</Button>
          </form>
        ) : null}
        {stage === "pending" ? (
          <div className="state-block" role="status" aria-live="polite">
            <div className="row"><span className="spinner" style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid", borderRightColor: "transparent", animation: "spin 800ms linear infinite" }} aria-hidden /><b>Saving your streak…</b></div>
            <p className="t-note t-muted">We're moving your shelf, days and friends onto your account. Your guest data stays on this phone until the save is confirmed.</p>
          </div>
        ) : null}
        {stage === "saved" ? (
          <>
            <p className="t-body">Your shelf, streak history and friends are on your account now. Sign in on a new phone to pick up where you left off.</p>
            <p className="t-note t-muted">Private answers (like pregnancy or prescriptions) stay on this phone only. On a new phone we'll ask again before planning treatments.</p>
            <Button variant="primary" onClick={onClose}>Done</Button>
          </>
        ) : null}
        {stage === "failed" ? (
          <div className="state-block state-block--error" role="alert">
            <b>We couldn't confirm the save</b>
            <p className="t-note t-muted">Nothing was deleted. Your guest shelf and streak are still on this phone. Try again in a moment.{correlation ? ` Reference: ${correlation}` : ""}</p>
            <Button size="md" block={false} onClick={() => setStage("choose")}>Try again</Button>
          </div>
        ) : null}
        {error && stage !== "failed" ? <InlineError error={error} /> : null}
      </div>
    </Sheet>
  );
}

// ---------------------------------------------------------------- Install (iOS steps vs Android prompt)
export function InstallSheet({ open, onClose, onSaveFirst, isGuest }: { open: boolean; onClose: () => void; onSaveFirst: () => void; isGuest: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [platform, setPlatform] = useState<Platform>("ios");
  const [canPrompt, setCanPrompt] = useState(false);
  const [standalone, setStandalone] = useState(false);
  useEffect(() => {
    const p = detectPlatform();
    setPlatform(p === "other" ? "ios" : p);
    setStandalone(isStandalone());
    setCanPrompt(canPromptInstall());
    const off = onInstallPromptChange(() => setCanPrompt(canPromptInstall()));
    return () => { off(); };
  }, []);
  return (
    <Sheet open={open} onClose={onClose} labelledBy="install-title">
      <div className="stack">
        <div className="row" style={{ ["--gap" as string]: "14px" }}>
          <span style={{ flex: "none", width: 64, height: 64, borderRadius: 16, background: COLOR.shell, display: "grid", placeItems: "center" }}>
            <ToneRing tones={DONE_TONES} size={40} strokeWidth={8} track={COLOR.ebony} />
          </span>
          <div>
            <h2 id="install-title" className="t-display t-h3" style={{ fontSize: 24 }}>Keep myrota on this phone</h2>
            <div className="t-note t-muted">Open it in one tap and get reminders.</div>
          </div>
        </div>
        {standalone ? <p className="note note--dew">You're already using myrota from your home screen.</p> : null}
        <div className="segmented" role="group" aria-label="Phone type">
          <button type="button" aria-pressed={platform === "ios"} onClick={() => setPlatform("ios")}>iPhone</button>
          <button type="button" aria-pressed={platform === "android"} onClick={() => setPlatform("android")}>Android</button>
        </div>
        {platform === "ios" ? (
          <>
            <ol className="card card--pearl" style={{ margin: 0, paddingLeft: 34, lineHeight: 1.75, fontSize: 14 }}>
              <li>Tap Share in Safari's toolbar</li>
              <li>Choose Add to Home Screen</li>
              <li>Open myrota from your home screen</li>
            </ol>
            <div className="card card--line" style={{ fontSize: 13, lineHeight: 1.5 }}>
              <b>Save your streak first.</b> On iPhone the Home Screen app can open without Safari's session, so it may look empty. Links in WhatsApp also open Safari, not the app. With a saved account you sign straight back in and nothing is lost. Reminders on iPhone only work from the Home Screen app.
            </div>
            {isGuest ? <Button variant="primary" onClick={onSaveFirst}>Save my streak, then add</Button> : null}
            <Button variant={isGuest ? "secondary" : "primary"} onClick={() => { onClose(); router.push("/settings/reminders"); }}>I've added it</Button>
          </>
        ) : (
          <>
            <p className="t-body t-muted">Chrome shows its own install prompt. Reminders also work in Chrome without installing.</p>
            <Button
              variant="primary"
              disabled={!canPrompt}
              onClick={async () => {
                const r = await promptInstall();
                if (r === "accepted") {
                  toast("Installed");
                  onClose();
                  router.push("/settings/reminders");
                }
              }}
            >
              Install myrota
            </Button>
            {!canPrompt ? <p className="t-small t-muted">Not offered by this browser right now. In Chrome, use the ⋮ menu → Install app.</p> : null}
            <Button onClick={() => { onClose(); router.push("/settings/reminders"); }}>Just turn on reminders</Button>
          </>
        )}
        <Button variant="text-muted" onClick={onClose}>Not now</Button>
      </div>
    </Sheet>
  );
}

// ---------------------------------------------------------------- Profile (behind avatar)
export function ProfileSheet({
  open,
  onClose,
  me,
  rotaLine,
  remindersLine,
  onEditName,
  onClaim,
  onInstall,
}: {
  open: boolean;
  onClose: () => void;
  me: MeResponse | null;
  rotaLine: string;
  remindersLine: string;
  onEditName: () => void;
  onClaim: () => void;
  onInstall: () => void;
}) {
  const router = useRouter();
  const saved = !!me && !me.isAnonymous;
  const rows: { k: string; v: string; act: () => void; strong?: boolean }[] = [
    { k: "Reminders", v: remindersLine, act: () => { onClose(); router.push("/settings/reminders"); } },
    { k: "Display name", v: me?.displayName ?? "Add", act: onEditName, strong: !me?.displayName },
    { k: "Account", v: saved ? `Saved · ${me!.identityProviders.join(", ")}` : "Save your streak", act: saved ? () => {} : onClaim, strong: !saved },
    { k: "This rota", v: rotaLine, act: () => { onClose(); router.push("/rota"); } },
    { k: "App", v: "Add to Home Screen", act: onInstall },
  ];
  return (
    <Sheet open={open} onClose={onClose} labelledBy="profile-title">
      <div className="stack" style={{ ["--gap" as string]: "0px" }}>
        <div className="row" style={{ marginBottom: 10, ["--gap" as string]: "12px" }}>
          <Avatar name={me?.displayName ?? null} size="lg" />
          <div>
            <h2 id="profile-title" className="t-display t-h3" style={{ fontSize: 24 }}>{me?.displayName ?? (saved ? "Saved account" : "Guest on this phone")}</h2>
            <div className="t-note t-sienna">{saved ? "Signed in" : "Streak saved on this device only"}</div>
          </div>
        </div>
        {rows.map((r) => (
          <button key={r.k} type="button" onClick={r.act} className="row" style={{ justifyContent: "space-between", minHeight: 52, background: "none", border: 0, borderBottom: `1px solid ${COLOR.track}`, textAlign: "left", padding: "12px 0" }}>
            <span className="t-strong">{r.k}</span>
            <span className="t-note" style={{ color: r.strong ? COLOR.ebony : COLOR.umber, fontWeight: r.strong ? 600 : 400 }}>{r.v}</span>
          </button>
        ))}
        <p className="t-small t-sienna" style={{ marginTop: 12 }}>Friends see your ring and streak. Never your products.</p>
        <div className="row" style={{ marginTop: 8 }}>
          <RotaMarker icon="settings" size={20} />
          <span className="t-small t-muted">Private answers stay on this phone.</span>
        </div>
      </div>
    </Sheet>
  );
}
