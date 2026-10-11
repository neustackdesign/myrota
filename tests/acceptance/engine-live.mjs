#!/usr/bin/env node
/**
 * LIVE engine scenarios A–G (Issue #19) against a deployed origin — the staging
 * Worker directly, or the public Vercel PWA origin (which proxies /api/*).
 * Offline twin: tests/backend/engine-scenarios.test.ts (same invariants).
 *
 *   BASE=https://myrota-staging.neustackdesign.workers.dev node tests/acceptance/engine-live.mjs
 *   BASE=https://myrota-staging-pilot.vercel.app SHISEIDO_IMAGE=/private/shiseido-back.jpg node tests/acceptance/engine-live.mjs
 *
 * SHISEIDO_IMAGE is a private, user-authorised photo path. It is uploaded to
 * /api/extract only; never commit it. Without it, scenario B is reported
 * SKIPPED, never PASS. A scan counts only if the response provider is the real
 * Workers AI vision model AND it returned usable ingredient/Drug Facts evidence.
 * Every product is saved, the rota is fetched again (refresh) and compared.
 */
import { readFileSync } from "node:fs";

const BASE = (process.env.BASE || "https://myrota-staging.neustackdesign.workers.dev").replace(/\/$/, "");
const IMAGE = process.env.SHISEIDO_IMAGE || "";
const tz = "Africa/Lagos";

function jar() {
  const c = {};
  return {
    header: () => Object.entries(c).map(([k, v]) => `${k}=${v}`).join("; "),
    absorb: (res) => { for (const s of res.headers.getSetCookie?.() ?? []) { const kv = s.split(";")[0]; const i = kv.indexOf("="); c[kv.slice(0, i).trim()] = kv.slice(i + 1).trim(); } },
  };
}
async function call(j, method, path, body, { form } = {}) {
  const headers = { origin: BASE, "x-captcha-response": "t", "x-myrota-time-zone": tz, ...(j.header() ? { cookie: j.header() } : {}) };
  if (!form) headers["content-type"] = "application/json";
  const res = await fetch(`${BASE}${path}`, { method, headers, body: form ?? (body ? JSON.stringify(body) : undefined), redirect: "manual" });
  j.absorb(res);
  let json = null; try { json = await res.json(); } catch {}
  return { status: res.status, json };
}
async function session() {
  const j = jar();
  const r = await call(j, "POST", "/api/auth/sign-in/anonymous", {});
  if (r.status >= 400) throw new Error(`anonymous sign-in ${r.status}`);
  return j;
}
const key = (s) => `${s}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function pasteProduct(j, name, category, inci) {
  const ex = await call(j, "POST", "/api/extract", { method: "paste", pastedText: inci });
  if (!ex.json?.ok) throw new Error(`paste extract failed ${ex.status}`);
  return save(j, { ...ex.json.candidate, name, category, source: "paste", inciStatus: "user_confirmed", identityStatus: "user_confirmed" });
}
async function basicProduct(j, name, category) {
  return save(j, { name, category, ingredients: [], source: "manual", inciStatus: "unknown", identityStatus: "user_confirmed" });
}
async function save(j, c) {
  const draft = {
    brand: c.brand ?? "", name: c.name, category: c.category, format: c.format ?? "unknown",
    identityStatus: c.identityStatus === "partial" ? "partial" : c.identityStatus ?? "user_confirmed",
    inciStatus: c.inciStatus ?? "unknown", source: c.source, ingredients: c.ingredients ?? [],
    labelActives: c.labelActives ?? [], extractionId: c.extractionId,
  };
  const r = await call(j, "POST", "/api/shelf", { draft });
  if (r.status !== 201 && !r.json?.duplicate) throw new Error(`shelf save ${r.status} ${JSON.stringify(r.json)}`);
  return r.json?.product ?? r.json;
}
async function buildRota(j) {
  const r = await call(j, "POST", "/api/rotas", { idempotencyKey: key("rota"), context: {} });
  if (r.status !== 201) throw new Error(`rota ${r.status} ${JSON.stringify(r.json)}`);
  return r.json.rota;
}

const pm = (r, d) => (r.days[d]?.pm ?? []).filter((s) => s.activeClass).map((s) => s.activeClass);
const STRONG = ["retinoid", "aha", "bha", "pha", "benzoyl_peroxide"];
const strong = (r, d) => pm(r, d).some((c) => STRONG.includes(c));
const exfol = (r, d) => pm(r, d).some((c) => ["aha", "bha", "pha"].includes(c));
const classes = (r) => new Set(r.days.flatMap((d) => [...d.am, ...d.pm]).map((s) => s.activeClass).filter(Boolean));
function spfLast(r) { return r.days.every((d) => { const i = d.am.findIndex((s) => s.category === "sunscreen"); return (i < 0 || i === d.am.length - 1) && !d.pm.some((s) => s.category === "sunscreen"); }); }
function spacing(r) {
  const n = r.days.filter((d) => strong(r, d.index)).length;
  for (let d = 0; d < 6; d += 1) if (exfol(r, d) && strong(r, d + 1)) return `strong night after exfoliant night ${d}`;
  return n <= 4 ? null : `${n} strong nights`;
}

const results = [];
async function scenario(id, fn) {
  try { const checks = await fn(); results.push({ id, checks }); }
  catch (e) { results.push({ id, checks: { run: { pass: false, got: String(e.message ?? e) } } }); }
}

await scenario("A pasted INCI → retinoid scheduled PM", async () => {
  const j = await session();
  await basicProduct(j, "Gentle cleanser", "cleanser");
  await pasteProduct(j, "Retinol serum", "serum", "Squalane, Caprylic/Capric Triglyceride, Retinol, Tocopherol");
  await basicProduct(j, "Moisturiser", "moisturiser");
  const r = await buildRota(j);
  const again = (await call(j, "GET", "/api/rotas/current")).json?.rota;
  return {
    "retinoid recognised + scheduled": { pass: classes(r).has("retinoid"), got: [...classes(r)].join(",") },
    "never AM": { pass: r.days.every((d) => !d.am.some((s) => s.activeClass === "retinoid")), got: "" },
    "step has reason": { pass: r.days.some((d) => d.pm.some((s) => s.activeClass === "retinoid" && s.reason)), got: "" },
    "refresh returns same rota": { pass: again?.id === r.id, got: again?.id ?? "none" },
  };
});

await scenario("B Shiseido photo → real OCR → UV filters → SPF last", async () => {
  if (!IMAGE) return { "real Shiseido photo required": { pass: false, got: "Provide SHISEIDO_IMAGE; missing image is a FAILED release gate, not a pass or silent skip." } };
  const j = await session();
  const cfg = (await call(j, "GET", "/api/config")).json;
  const form = new FormData();
  form.set("image", new Blob([readFileSync(IMAGE)], { type: "image/jpeg" }), "label.jpg");
  form.set("method", "scan");
  form.set("side", process.env.SHISEIDO_SIDE === "front" ? "front" : "back");
  const ex = await call(j, "POST", "/api/extract", null, { form });
  const c = ex.json?.candidate;
  const real = typeof c?.provider === "string" && c.provider.startsWith("workers_ai_vision:");
  const evidence = (c?.ingredients?.length ?? 0) + (c?.labelActives?.length ?? 0);
  const EXPECTED_UV = new Map([["avobenzone", 2.5], ["homosalate", 10], ["octisalate", 5], ["octocrylene", 10]]);
  const actualUV = new Map((c?.labelActives ?? []).map((a) => [String(a.name).toLowerCase(), a.percentage]));
  const exactUV = [...EXPECTED_UV].every(([name, pct]) => actualUV.get(name) === pct);
  const out = {
    "photoReading capability": { pass: cfg?.capabilities?.photoReading === true, got: JSON.stringify(cfg?.capabilities) },
    "processed by Workers AI vision": { pass: real, got: `${ex.status} ${c?.provider ?? ex.json?.problem ?? ex.json?.error}` },
    "exact four Shiseido UV actives from the image": { pass: real && exactUV, got: `ingredients=${c?.ingredients?.length ?? 0} labelActives=${(c?.labelActives ?? []).map((a) => `${a.name} ${a.percentage}%`).join(", ")}` },
    "product identity read, not substituted": { pass: /shiseido/i.test(c?.brand ?? "") && /clear sunscreen stick/i.test(c?.name ?? ""), got: `${c?.brand ?? "?"} — ${c?.name ?? "?"}` },
    "incomplete formula is not verified": { pass: c?.inciStatus !== "verified" && c?.inciStatus !== "user_confirmed", got: c?.inciStatus ?? "missing" },
  };
  if (!real || !evidence || !exactUV) return out;
  await basicProduct(j, "Gentle cleanser", "cleanser");
  await basicProduct(j, "Moisturiser", "moisturiser");
  const saved = await save(j, { ...c, source: "scan" });
  const shelf = (await call(j, "GET", "/api/shelf")).json;
  const r = await buildRota(j);
  const persisted = shelf?.products?.find((p) => p.id === saved?.id);
  const storedUV = new Map((persisted?.labelActives ?? []).map((a) => [String(a.name).toLowerCase(), a.percentage]));
  const hasAllUV = [...EXPECTED_UV].every(([name, pct]) => storedUV.get(name) === pct);
  out["all four actives persisted after fetch"] = { pass: !!persisted && hasAllUV, got: `persisted=${!!persisted} uv=${(persisted?.labelActives ?? []).length}` };
  out["saved full-INCI status still incomplete"] = { pass: !!persisted && !["verified", "user_confirmed"].includes(persisted.inciStatus), got: persisted?.inciStatus ?? "missing" };
  out["SPF scheduled last every AM, never PM"] = { pass: r.days.every((d) => d.am.at(-1)?.productId === saved?.id && !d.pm.some((p) => p.productId === saved?.id)), got: r.days.map((d) => d.am.at(-1)?.category ?? "none").join(",") };
  return out;
});

await scenario("C/D PHA + SPF + moisturiser: order and spacing", async () => {
  const j = await session();
  await pasteProduct(j, "PHA toner", "toner", "Aqua, Gluconolactone, Lactobionic Acid, Glycerin");
  await basicProduct(j, "Moisturiser", "moisturiser");
  await pasteProduct(j, "SPF 50", "sunscreen", "Aqua, Homosalate, Octocrylene, Avobenzone, Glycerin");
  const r = await buildRota(j);
  return { "PHA scheduled": { pass: classes(r).has("pha"), got: [...classes(r)].join(",") }, "SPF last AM": { pass: spfLast(r), got: "" }, "recovery spacing": { pass: !spacing(r), got: spacing(r) ?? "ok" } };
});

await scenario("E vitamin C + niacinamide daily", async () => {
  const j = await session();
  await pasteProduct(j, "Vitamin C serum", "serum", "Aqua, Ascorbic Acid, Glycerin");
  await pasteProduct(j, "Niacinamide serum", "serum", "Aqua, Niacinamide, Zinc PCA");
  const r = await buildRota(j);
  return { "both daily": { pass: r.days.every((d) => ["vitamin_c", "niacinamide"].every((c) => [...d.am, ...d.pm].some((s) => s.activeClass === c))), got: [...classes(r)].join(",") } };
});

await scenario("F retinoid + AHA alternate with recovery nights", async () => {
  const j = await session();
  await basicProduct(j, "Gentle cleanser", "cleanser");
  await pasteProduct(j, "Retinol serum", "serum", "Squalane, Retinol, Tocopherol");
  await pasteProduct(j, "Glycolic toner", "toner", "Aqua, Glycolic Acid, Glycerin, Sodium Hydroxide");
  await basicProduct(j, "Moisturiser", "moisturiser");
  const r = await buildRota(j);
  const ret = r.days.filter((d) => pm(r, d.index).includes("retinoid")).map((d) => d.index);
  const aha = r.days.filter((d) => pm(r, d.index).includes("aha")).map((d) => d.index);
  const gap = ret.every((a) => aha.every((b) => Math.abs(a - b) >= 2));
  return {
    "both scheduled": { pass: ret.length > 0 && aha.length > 0, got: `retinoid ${ret} · AHA ${aha}` },
    "recovery night between them": { pass: gap, got: "" },
    "≤4 strong nights, none after exfoliant": { pass: !spacing(r), got: spacing(r) ?? "ok" },
  };
});

await scenario("G replan after adding retinoid keeps completed day 0, streak, Rescue", async () => {
  const j = await session();
  await basicProduct(j, "Gentle cleanser", "cleanser");
  await basicProduct(j, "Moisturiser", "moisturiser");
  const first = await buildRota(j);
  const d0 = first.days[0];
  for (const s of ["am", "pm"].filter((k) => d0[k].length)) {
    await call(j, "POST", "/api/completions", { rotaId: first.id, skincareDate: d0.skincareDate, session: s, idempotencyKey: key("c") });
  }
  const before = (await call(j, "GET", "/api/today")).json;
  await pasteProduct(j, "Retinol serum", "serum", "Squalane, Retinol, Tocopherol");
  const second = await buildRota(j);
  const after = (await call(j, "GET", "/api/today")).json;
  const day0 = (after?.records ?? []).filter((r) => r.skincareDate === d0.skincareDate);
  return {
    "rota changed": { pass: second.id !== first.id && classes(second).has("retinoid"), got: `${first.id.slice(0, 8)} → ${second.id.slice(0, 8)}` },
    "same week": { pass: second.startDate === first.startDate && (second.supersedes ?? []).includes(first.id), got: `${second.startDate} supersedes=${(second.supersedes ?? []).length}` },
    "day 0 still completed": { pass: day0.some((r) => r.events.length > 0), got: `${day0.length} record(s)` },
    "day 0 plan unchanged": { pass: JSON.stringify(second.days[0]) === JSON.stringify(d0), got: "" },
    "rescue unchanged": { pass: (second.rescueUsedFor ?? null) === (first.rescueUsedFor ?? null), got: String(second.rescueUsedFor ?? null) },
    "records preserved": { pass: (after?.records?.length ?? 0) >= (before?.records?.length ?? 0), got: `${before?.records?.length}→${after?.records?.length}` },
  };
});

console.log(`==== live engine scenarios @ ${BASE} ====`);
let failed = 0;
for (const r of results) {
  console.log(`\n${r.id}`);
  for (const [name, c] of Object.entries(r.checks)) {
    const tag = c.pass === null ? "SKIP" : c.pass ? "PASS" : "FAIL";
    if (c.pass === false) failed += 1;
    console.log(`  ${tag}  ${name}${c.got ? ` — ${c.got}` : ""}`);
  }
}
console.log(`\n==== ${failed ? `${failed} check(s) FAILED` : "no failures"} ====`);
process.exit(failed ? 1 : 0);
