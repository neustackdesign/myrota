import Link from "next/link";

export default async function InvitePage({
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const query = await searchParams;
  const inviter = query.from && query.from !== "myrota" ? query.from : "A friend";

  return (
    <main className="shell">
      <header className="topbar">
        <Link className="brand" href="/">myrota</Link>
        <span className="pill">7-day Skin Streak</span>
      </header>

      <section className="hero">
        <div className="eyebrow">You have an invite</div>
        <h1>{inviter} wants company.</h1>
        <p className="lede">
          You will not copy their skincare routine. Add what you already own,
          get your own seven-day rota, and keep the streak going together.
        </p>
        <Link className="button lime" href="/build?invite=1">
          Build my rota →
        </Link>
      </section>

      <section className="grid">
        <article className="card stat">
          <span className="muted">Start with</span>
          <strong>1+</strong>
          <span>One product is enough to join.</span>
        </article>
        <article className="card stat">
          <span className="muted">Your routine</span>
          <strong>Yours</strong>
          <span>No copying somebody else's prescription.</span>
        </article>
        <article className="card stat">
          <span className="muted">Shared</span>
          <strong>Streak</strong>
          <span>Different shelves. Same commitment.</span>
        </article>
      </section>
    </main>
  );
}
