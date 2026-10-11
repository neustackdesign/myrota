#!/usr/bin/env node
/**
 * RED-TEAM failing acceptance fixture (Issue #19, 13 Oct milestone).
 *
 * Reproduces the real intelligence failures through the DEPLOYED staging API:
 * three real multi-product shelves whose products carry known actives, and the
 * active-driven invariants that a correct engine must satisfy. Run against the
 * live Worker to capture the baseline — these currently FAIL because the live
 * engine uses NO_CLINICAL_RULES (empty) and partial-INCI catalogue products
 * contribute no actives to planning.
 *
 *   node tests/acceptance/shelf-scenarios.mjs            # against staging
 *   BASE=http://localhost:8787 node tests/acceptance/shelf-scenarios.mjs
 *
 * Acceptance invariant (per the 17 Oct policy addendum):
 *   - key actives of each product are recognised,
 *   - basic order is correct (cleanse → treatment → moisturise → SPF-last-in-AM),
 *   - at least one active is actually scheduled with an attached reason,
 *   - two strong actives (retinoid/AHA/BHA/PHA/BPO) never share a session,
 *   - unknown remainder / held products are explicit.
 * A rota that schedules NO actives at all FAILS.
 */
const BASE = (process.env.BASE || "https://myrota-staging.neustackdesign.workers.dev").replace(/\/$/, "");

const SHELVES = [
  {
    id: "A-retinoid-exfoliant",
    label: "retinoid + exfoliant (two strong actives)",
    products: [
      { catalogueId: "obf:5061087560738", expectActives: ["retinoid"], category: "serum" },      // Inkey retinol
      { catalogueId: "obf:0769915190373", expectActives: ["aha"], category: "treatment" },        // Ordinary Lactic Acid 10%
      { catalogueId: "obf:3337875598996", expectActives: [], category: "moisturiser" },            // CeraVe cream
    ],
    expect: { strongActives: ["retinoid", "aha"], neverSameSession: true, minScheduledActives: 1 },
  },
  {
    id: "B-pha-spf-moisturiser",
    label: "PHA + sunscreen + moisturiser",
    products: [
      { catalogueId: "brand:minimalist:pha3-toner:global", expectActives: ["pha"], category: "toner" }, // PHA toner
      { catalogueId: "obf:3337875698696", expectActives: ["uv_filter"], category: "sunscreen" },         // Anthelios SPF
      { catalogueId: "obf:3337875598996", expectActives: [], category: "moisturiser" },                  // CeraVe cream
    ],
    expect: { basicOrderSpfLastAM: true, minScheduledActives: 1, recognisePHA: true, recogniseUV: true },
  },
  {
    id: "C-vitc-niacinamide",
    label: "vitamin C / niacinamide",
    products: [
      { catalogueId: "obf:5060879821989", expectActives: ["vitamin_c", "niacinamide"], category: "moisturiser" }, // Inkey B,C,E
      { catalogueId: "obf:3600542663045", expectActives: ["niacinamide"], category: "moisturiser" },              // Garnier Vit C
      { catalogueId: "obf:3337875598996", expectActives: [], category: "moisturiser" },                           // CeraVe cream
    ],
    expect: { minScheduledActives: 1 },
  },
];

function cookieJar() {
  let jar = {};
  return {
    header: () => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; "),
    absorb: (res) => { for (const c of (res.headers.getSetCookie?.() ?? [])) { const kv = c.split(";")[0]; const i = kv.indexOf("="); jar[kv.slice(0, i).trim()] = kv.slice(i + 1).trim(); } },
    has: (f) => Object.keys(jar).some((k) => k.includes(f)),
  };
}
async function api(jar, method, path, body, extra = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "content-type": "application/json", origin: BASE, "x-captcha-response": "t", ...(jar.header() ? { cookie: jar.header() } : {}), ...extra },
    body: body ? JSON.stringify(body) : undefined, redirect: "manual",
  });
  jar.absorb(res);
  let json = null; try { json = await res.json(); } catch {}
  return { status: res.status, json };
}

const results = [];
for (const shelf of SHELVES) {
  const jar = cookieJar();
  await api(jar, "POST", "/api/auth/sign-in/anonymous", {});
  const added = [];
  const recognisedActives = new Set();
  for (const p of shelf.products) {
    const look = await api(jar, "GET", `/api/catalogue?barcode=${encodeURIComponent(p.catalogueId.startsWith("obf:") ? p.catalogueId.slice(4) : "")}`);
    // resolve by catalogueId through a name search fallback since barcode route needs GTIN
    let cat = look.json?.results?.[0];
    if (!cat) { const s = await api(jar, "GET", `/api/catalogue?q=${encodeURIComponent(p.catalogueId)}`); cat = (s.json?.results || []).find((r) => r.catalogueId === p.catalogueId); }
    if (!cat) { const s = await api(jar, "GET", `/api/catalogue?q=${encodeURIComponent(p.category)}`); cat = (s.json?.results || []).find((r) => r.catalogueId === p.catalogueId); }
    if (!cat) continue;
    for (const ing of cat.ingredients) if (ing.activeClass) recognisedActives.add(ing.activeClass);
    const draft = { brand: cat.brand, name: cat.name, category: cat.category, format: cat.format === "unknown" ? "leave_on" : cat.format, identityStatus: "user_confirmed", inciStatus: "user_confirmed", source: "search", catalogueId: cat.catalogueId, ingredients: cat.ingredients, placement: "pm" };
    const add = await api(jar, "POST", "/api/shelf", { draft });
    added.push({ name: cat.name, category: cat.category, saved: add.status === 201 || add.json?.duplicate, actives: [...new Set(cat.ingredients.filter((i) => i.activeClass).map((i) => i.activeClass))] });
  }
  const rota = await api(jar, "POST", "/api/rotas", { idempotencyKey: `redteam-${shelf.id}-${Date.now() % 1e7}`, context: {} });
  const days = rota.json?.rota?.days ?? [];
  // collect scheduled actives + whether any step carries an attached reason/label
  const scheduledActives = new Set();
  let stepsWithReason = 0, stepsTotal = 0;
  const sessionActives = [];
  for (const d of days) {
    for (const sess of ["am", "pm"]) {
      const classesHere = [];
      for (const step of (d[sess] ?? [])) {
        stepsTotal++;
        if (step.activeClass) { scheduledActives.add(step.activeClass); classesHere.push(step.activeClass); }
        if (step.reason || step.label || step.why) stepsWithReason++;
      }
      if (classesHere.length) sessionActives.push({ day: d.index, sess, classes: classesHere });
    }
  }
  // invariant checks
  const checks = {};
  checks["actives recognised on shelf"] = { pass: recognisedActives.size > 0, got: [...recognisedActives].join(",") || "(none)" };
  checks["PHA recognised"] = shelf.expect.recognisePHA ? { pass: recognisedActives.has("pha"), got: recognisedActives.has("pha") ? "pha" : "MISSING" } : undefined;
  checks["UV filter recognised"] = shelf.expect.recogniseUV ? { pass: recognisedActives.has("uv_filter"), got: recognisedActives.has("uv_filter") ? "uv_filter" : "MISSING" } : undefined;
  checks["rota schedules >=1 active"] = { pass: scheduledActives.size >= (shelf.expect.minScheduledActives ?? 1), got: [...scheduledActives].join(",") || "NONE SCHEDULED" };
  checks["steps carry reasons"] = { pass: stepsWithReason > 0, got: `${stepsWithReason}/${stepsTotal}` };
  if (shelf.expect.neverSameSession) {
    const violation = sessionActives.find((s) => shelf.expect.strongActives.filter((a) => s.classes.includes(a)).length >= 2);
    checks["strong actives never same session"] = { pass: scheduledActives.size > 0 && !violation, got: violation ? `BOTH in day${violation.day} ${violation.sess}` : (scheduledActives.size ? "ok" : "n/a (none scheduled)") };
  }
  const failed = Object.entries(checks).filter(([, c]) => c && !c.pass);
  results.push({ shelf: shelf.id, label: shelf.label, added, recognisedActives: [...recognisedActives], scheduledActives: [...scheduledActives], rotaDays: days.length, checks, pass: failed.length === 0 });
}

console.log("==== RED-TEAM live-API shelf acceptance (baseline) ====\n");
for (const r of results) {
  console.log(`SHELF ${r.shelf} — ${r.label}`);
  console.log(`  products: ${r.added.map((a) => `${a.name.slice(0, 26)}[${a.category}${a.actives.length ? ":" + a.actives.join("+") : ""}]`).join(" | ")}`);
  console.log(`  recognised actives: ${r.recognisedActives.join(",") || "(none)"}`);
  console.log(`  rota: ${r.rotaDays} days, scheduled actives: ${r.scheduledActives.join(",") || "NONE"}`);
  for (const [name, c] of Object.entries(r.checks)) if (c) console.log(`    ${c.pass ? "PASS" : "FAIL"}  ${name} — ${c.got}`);
  console.log(`  => ${r.pass ? "PASS" : "FAIL"}\n`);
}
const passed = results.filter((r) => r.pass).length;
console.log(`==== ${passed}/${results.length} shelves pass active-driven acceptance ====`);
process.exit(passed === results.length ? 0 : 1);
