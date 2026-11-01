#!/usr/bin/env node
/**
 * Live completion + persistence acceptance, against the DEPLOYED staging Worker + D1.
 *
 *   node tests/acceptance/completion-persistence.mjs          # against staging
 *   BASE=http://localhost:8787 node tests/acceptance/completion-persistence.mjs
 *
 * What the live E2E could not reach (the UI hides the PM button before evening):
 *   1. a scheduled session completes through the real route and PERSISTS,
 *   2. a FRESH GET /api/today (i.e. a refresh) still shows it done,
 *   3. replaying the same idempotency key does not double-record,
 *   4. a date outside the rota is rejected at the route (no retroactive write).
 * The route stamps occurredAt with the SERVER clock, so completion is accepted
 * any time inside the day's 04:00→04:00 window — the "evening" is a UI framing,
 * not a server rule. The boundary maths itself is clock-controlled in
 * tests/domain/scenarios.test.ts scenario 10.
 */
const BASE = (process.env.BASE || "https://myrota-staging.neustackdesign.workers.dev").replace(/\/$/, "");
const TZ = "Africa/Lagos";

function cookieJar() {
  let jar = {};
  return {
    header: () => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; "),
    absorb: (res) => { for (const c of (res.headers.getSetCookie?.() ?? [])) { const kv = c.split(";")[0]; const i = kv.indexOf("="); jar[kv.slice(0, i).trim()] = kv.slice(i + 1).trim(); } },
  };
}
async function api(jar, method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "content-type": "application/json", origin: BASE, "x-captcha-response": "t", "x-myrota-time-zone": TZ, ...(jar.header() ? { cookie: jar.header() } : {}) },
    body: body ? JSON.stringify(body) : undefined, redirect: "manual",
  });
  jar.absorb(res);
  let json = null; try { json = await res.json(); } catch {}
  return { status: res.status, json };
}

const checks = [];
const check = (name, pass, got) => { checks.push({ name, pass, got }); };

const jar = cookieJar();
await api(jar, "POST", "/api/auth/sign-in/anonymous", {});

// One pasted cleanser → today's day 0 has a real scheduled AM+PM session.
const ex = await api(jar, "POST", "/api/extract", { method: "paste", pastedText: "Aqua, Glycerin, Coco-Betaine, Sodium Chloride, Citric Acid" });
const cand = ex.json?.candidate;
await api(jar, "POST", "/api/shelf", { draft: { brand: null, name: "Pasted cleanser", category: "cleanser", format: "leave_on", identityStatus: "unknown", inciStatus: cand?.inciStatus ?? "partial", source: "paste", ingredients: cand?.ingredients ?? [], placement: "pm" } });
await api(jar, "POST", "/api/rotas", { idempotencyKey: `completion-persist-${Date.now()}`, context: {} });

// /api/today returns the raw store; the client derives the view. Day 0's
// skincareDate IS the current skincare day (startDate = skincareDateAt(now)).
const t0 = await api(jar, "GET", "/api/today");
const rota = t0.json?.rota;
const rotaId = rota?.id;
const day0 = rota?.days?.[0];
const skincareDate = day0?.skincareDate;
const sessionKind = day0?.pm?.length ? "pm" : day0?.am?.length ? "am" : null;
const pmEventsFor = (json, date, session) =>
  (json?.records ?? []).filter((r) => r.rotaId === rotaId && r.skincareDate === date).flatMap((r) => r.events ?? []).filter((e) => e.session === session);
check("rota starts today with a scheduled session on day 0", !!rotaId && !!skincareDate && !!sessionKind, `rota=${rotaId?.slice(0, 8)} date=${skincareDate} session=${sessionKind} serverNow=${t0.json?.serverNow}`);

if (rotaId && sessionKind) {
  check("session starts with no completion event", pmEventsFor(t0.json, skincareDate, sessionKind).length === 0, `events=${pmEventsFor(t0.json, skincareDate, sessionKind).length}`);

  const key = `persist-${sessionKind}-${Date.now()}`;
  const post = await api(jar, "POST", "/api/completions", { rotaId, skincareDate, session: sessionKind, idempotencyKey: key });
  const events = post.json?.record?.events ?? [];
  check("completion accepted (200) and one event recorded", post.status === 200 && events.length === 1, `status=${post.status} events=${events.length}`);
  check("event stamped inside today's skincare day", events[0]?.skincareDate === skincareDate, `${events[0]?.skincareDate} occurredAt=${events[0]?.occurredAt}`);

  // Refresh: a brand-new GET must still show the event — proves the D1 write stuck.
  const t1 = await api(jar, "GET", "/api/today");
  check("persists across refresh (fresh GET shows the event)", pmEventsFor(t1.json, skincareDate, sessionKind).length === 1, `events=${pmEventsFor(t1.json, skincareDate, sessionKind).length}`);

  // Replay same key: idempotent, no second event.
  const replay = await api(jar, "POST", "/api/completions", { rotaId, skincareDate, session: sessionKind, idempotencyKey: key });
  check("replay is idempotent (still one event)", replay.status === 200 && (replay.json?.record?.events?.length ?? 0) === 1, `status=${replay.status} events=${replay.json?.record?.events?.length}`);

  // A date outside the rota is rejected at the route — no retroactive write.
  const retro = await api(jar, "POST", "/api/completions", { rotaId, skincareDate: "2026-09-01", session: sessionKind, idempotencyKey: `retro-${Date.now()}` });
  check("date outside the rota is rejected (no retroactive write)", retro.status === 422, `status=${retro.status} error=${retro.json?.error}`);
}

const failed = checks.filter((c) => !c.pass);
for (const c of checks) console.log(`${c.pass ? "PASS" : "FAIL"}  ${c.name}  — ${c.got}`);
console.log(`\n${checks.length - failed.length}/${checks.length} passed against ${BASE}`);
process.exit(failed.length ? 1 : 0);
