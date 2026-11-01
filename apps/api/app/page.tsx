import Link from "next/link";

export default function HomePage() {
  return (
    <main className="shell">
      <header className="topbar">
        <Link className="brand" href="/">myrota</Link>
        <Link className="pill" href="/mix">Can I mix these?</Link>
      </header>

      <section className="hero">
        <div className="eyebrow">Use what you already own</div>
        <h1>Your shelf already has a routine in it.</h1>
        <p className="lede">
          Add the skincare you already own. myrota turns it into a simple
          seven-day plan — what to use, what to separate, and what to do today.
        </p>
        <div className="actions">
          <Link className="button lime" href="/build">Build my rota →</Link>
          <Link className="button secondary" href="/mix">Check two actives</Link>
        </div>
      </section>

      <section className="grid" aria-label="How myrota works">
        <article className="card stat">
          <span className="muted">First plan</span>
          <strong>7 days</strong>
          <span>Enough structure to stop guessing.</span>
        </article>
        <article className="card stat">
          <span className="muted">Daily effort</span>
          <strong>2 taps</strong>
          <span>AM done. PM done. No product-by-product chore.</span>
        </article>
        <article className="card stat">
          <span className="muted">Social loop</span>
          <strong>1 friend</strong>
          <span>Do your own routines. Keep the streak together.</span>
        </article>
      </section>

      <section className="section">
        <div className="eyebrow">The job</div>
        <h2>Less skincare chaos. More follow-through.</h2>
        <p className="lede">
          myrota is not trying to sell you a ten-step routine. It starts with
          what is already in your bathroom and turns that shelf into something
          you can actually follow.
        </p>
      </section>

      <p className="footer-note">
        Early product build. Guidance is being reviewed and expanded as the
        product catalogue grows.
      </p>
    </main>
  );
}
