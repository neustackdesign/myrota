"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { PhotoSlot } from "@/components/brand/PhotoSlot";
import { Wordmark } from "@/components/brand/Wordmark";
import { Avatar, Button, ErrorBlock, InlineError, LoadingBlock, useToast } from "@/components/ui/primitives";
import { useFlow } from "@/lib/client/flow";
import { useRepository, useResource } from "@/lib/client/runtime";

export default function InviteLandingPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const repo = useRepository();
  const toast = useToast();
  const { update } = useFlow();
  const preview = useResource((r) => r.invitePreview(token), [token]);
  const me = useResource((r) => r.me());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const name = preview.data?.inviterDisplayName ?? "Your friend";
  const existing = !!me.data?.hasRota;
  const status = preview.data?.status;

  return (
    <div className="app-frame app-frame--pearl app-frame--wide">
      <main id="main" className="app-main split">
        <section className="grain grain--skin" style={{ position: "relative", padding: "calc(20px + env(safe-area-inset-top)) 16px 0", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ paddingLeft: 6 }}><Wordmark size={24} /></div>
          {status === "active" ? (
            <div className="row" style={{ alignSelf: "flex-start", background: "#FBFAF6", border: "2px solid #2A1911", borderRadius: 999, padding: "5px 12px 5px 5px", ["--gap" as string]: "8px" }}>
              <Avatar name={name} size="sm" variant="friend" />
              <span className="t-strong" style={{ fontSize: 13 }}>{name}{preview.data?.inviterStreak ? ` · ${preview.data.inviterStreak}-day streak` : ""}</span>
            </div>
          ) : null}
          <PhotoSlot asset="inviteHero" style={{ width: "100%", maxHeight: 420 }} />
        </section>
        <section className="pad stack" style={{ padding: "22px 22px calc(22px + env(safe-area-inset-bottom))", justifyContent: "center", ["--gap" as string]: "12px" }}>
          {preview.loading && !preview.data ? <LoadingBlock lines={2} label="Opening invite" /> : null}
          {preview.error ? <ErrorBlock error={preview.error} onRetry={preview.reload} title="We couldn't open this invite" /> : null}
          {status === "active" ? (
            <>
              <h1 className="t-display" style={{ fontSize: 30 }}>{name} invited you to build your own rota.</h1>
              <p className="t-body t-muted">Your week gets planned around your products. {name} won't see your shelf and you won't see theirs. You'll only see each other's streaks.</p>
              <InlineError error={error} />
              {existing ? (
                <Button
                  variant="primary"
                  busy={busy}
                  onClick={async () => {
                    setBusy(true);
                    setError(null);
                    try {
                      const res = await repo.acceptInvite(token);
                      toast(res.alreadyPaired ? `You and ${name} were already paired` : `You and ${name} are paired`);
                      router.replace("/today");
                    } catch (e) {
                      setError(e);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Pair with {name}
                </Button>
              ) : (
                <Button
                  variant="primary"
                  onClick={() => {
                    update({ source: "invite", inviteToken: token, inviterName: name });
                    router.push("/build?src=invite");
                  }}
                >
                  Start with what I have
                </Button>
              )}
              <span className="t-note t-muted center" style={{ textAlign: "center" }}>
                {existing ? `You keep your own rota. ${name} sees your streak, never your shelf.` : "One product is enough. No account, no download."}
              </span>
            </>
          ) : null}
          {status === "expired" || status === "not_found" ? (
            <div className="state-block">
              <b>{status === "expired" ? "This invite has expired" : "This invite link doesn't work"}</b>
              <p className="t-note t-muted">Ask your friend to send their link again. You can still build your own rota now.</p>
              <Link className="btn btn--primary btn--lg btn--block" href="/build?src=organic">Build my own rota</Link>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}
