"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { RotaMarker } from "@/components/brand/RotaMarker";
import { BackButton, Button, InlineError, useToast } from "@/components/ui/primitives";
import { detectPlatform, isStandalone, pushSupported } from "@/lib/client/pwa";
import { useRepository, useResource } from "@/lib/client/runtime";
import { COLOR } from "@/lib/ui/ring";

const AM = ["06:30", "07:30", "08:30"];
const PM = ["20:00", "21:00", "22:00"];

type Perm = "default" | "granted" | "denied" | "unsupported" | "ios-needs-install";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export default function RemindersPage() {
  const router = useRouter();
  const repo = useRepository();
  const toast = useToast();
  const state = useResource((r) => r.reminders());
  const config = useResource((r) => r.config().catch(() => null));
  const [am, setAm] = useState("07:30");
  const [pm, setPm] = useState("21:00");
  const [perm, setPerm] = useState<Perm>("default");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (state.data) {
      setAm(state.data.am);
      setPm(state.data.pm);
    }
  }, [state.data]);
  useEffect(() => {
    if (detectPlatform() === "ios" && !isStandalone()) setPerm("ios-needs-install");
    else if (!pushSupported()) setPerm("unsupported");
    else setPerm(Notification.permission as Perm);
  }, []);

  const save = async (enabled: boolean, subscription?: unknown) =>
    repo.putReminders({ am, pm, enabled, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, subscription });

  const turnOn = async () => {
    setBusy(true);
    setError(null);
    try {
      // Permission is requested only here, after a clear tap.
      const result = await Notification.requestPermission();
      setPerm(result as Perm);
      if (result !== "granted") {
        await save(false);
        toast("No reminders. You can turn them on in Profile.");
        return;
      }
      const key = config.data?.vapidPublicKey;
      if (!key) {
        await save(true);
        toast("Times saved. Push reminders aren't connected yet.");
        router.replace("/today");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) });
      await save(true, sub.toJSON());
      toast(`Reminders on: ${am} and ${pm}`);
      router.replace("/today");
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  const chip = (t: string, on: boolean, set: () => void, dark: boolean) => (
    <button key={t} type="button" aria-pressed={on} onClick={set} style={{ flex: 1, minHeight: 48, borderRadius: 14, fontWeight: 600, fontSize: 15, color: on && dark ? COLOR.porcelain : COLOR.ebony, background: on ? (dark ? COLOR.dusk : COLOR.apricot) : COLOR.porcelain, border: `2px solid ${on ? COLOR.ebony : COLOR.track}` }}>
      {t}
    </button>
  );

  return (
    <div className="app-frame">
      <main id="main" className="app-main pad top-pad stack" style={{ minHeight: "100dvh", paddingBottom: "calc(24px + env(safe-area-inset-bottom))", ["--gap" as string]: "14px" }}>
        <div className="row"><BackButton fallback="/today" /></div>
        <RotaMarker icon="reminder" size={60} mode="colour" accent={COLOR.apricot} />
        <h1 className="t-display" style={{ fontSize: 30 }}>When do you usually do your skin?</h1>
        <p className="t-body t-muted">One nudge per session. None once you've marked it done.</p>
        <span className="t-label">Morning</span>
        <div className="row" style={{ ["--gap" as string]: "8px" }} role="group" aria-label="Morning reminder time">{AM.map((t) => chip(t, am === t, () => setAm(t), false))}</div>
        <span className="t-label">Evening</span>
        <div className="row" style={{ ["--gap" as string]: "8px" }} role="group" aria-label="Evening reminder time">{PM.map((t) => chip(t, pm === t, () => setPm(t), true))}</div>
        {perm === "ios-needs-install" ? (
          <p className="note note--pearl">On iPhone, reminders only work from the Home Screen app. Add myrota to your Home Screen, open it from there, then turn reminders on.</p>
        ) : null}
        {perm === "unsupported" ? <p className="note note--pearl">This browser can't show web reminders. Your times are still saved for when you switch.</p> : null}
        {perm === "denied" ? <p className="note note--sienna">Notifications are blocked for myrota. Allow them in your browser or phone settings, then try again.</p> : null}
        {state.data?.enabled ? <p className="note note--dew">Reminders are on: {state.data.am} and {state.data.pm}.</p> : null}
        <InlineError error={error ?? state.error} />
        <div className="stack mt-auto center" style={{ ["--gap" as string]: "6px" }}>
          {perm === "default" || perm === "granted" ? (
            <Button variant="primary" busy={busy} onClick={turnOn}>{state.data?.enabled ? "Update reminders" : "Turn on reminders"}</Button>
          ) : (
            <Button variant="primary" busy={busy} onClick={async () => { setBusy(true); try { await save(false); toast("Times saved"); router.replace("/today"); } catch (e) { setError(e); } finally { setBusy(false); } }}>Save times</Button>
          )}
          <button type="button" className="btn btn--text" onClick={() => router.replace("/today")}>Not now</button>
        </div>
      </main>
    </div>
  );
}
