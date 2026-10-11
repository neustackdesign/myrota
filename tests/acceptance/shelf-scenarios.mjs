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
 * Acceptance invariant (per the CURRENT Issue #19 consumer routine policy):
 *   - key actives of each product are recognised,
 *   - basic order is correct (cleanse → treatment → moisturise → SPF-last-in-AM),
 *   - eligible strong actives are actually scheduled (both on the retinoid+AHA shelf), with rationale,
 *   - different intensive products are placed on separate sessions as a transparent default,
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
    expect: { strongActives: ["retinoid", "aha"], neverSameSession: true, minScheduledActives: 2 },
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

// ---- helpers for the Issue #19 extended scenarios (added 2026-10-11) ----
async function resolveCatalogue(jar, catalogueId, barcode) {
  const gtin = barcode ?? (catalogueId.startsWith("obf:") ? catalogueId.slice(4) : null);
  if (gtin) {
    const look = await api(jar, "GET", `/api/catalogue?barcode=${encodeURIComponent(gtin)}`);
    const rs = look.json?.results || [];
    const hit = rs.find((r) => r.catalogueId === catalogueId) ?? rs[0];
    if (hit) return hit;
  }
  const s = await api(jar, "GET", `/api/catalogue?q=${encodeURIComponent(catalogueId)}`);
  return (s.json?.results || []).find((r) => r.catalogueId === catalogueId) ?? null;
}
async function addCatalogue(jar, cat, placement) {
  const draft = { brand: cat.brand, name: cat.name, category: cat.category, format: cat.format === "unknown" ? "leave_on" : cat.format, identityStatus: "user_confirmed", inciStatus: cat.inciStatus ?? "partial", source: "search", catalogueId: cat.catalogueId, ingredients: cat.ingredients, placement };
  return api(jar, "POST", "/api/shelf", { draft });
}
// Pasted INCI: no catalogue identity, user picks the category. Actives are
// recognised server-side from the pasted text, not from any SKU.
async function addPaste(jar, pastedText, category, placement) {
  const ex = await api(jar, "POST", "/api/extract", { method: "paste", pastedText });
  const cand = ex.json?.candidate;
  if (!cand) return { ok: false, actives: [] };
  const draft = { brand: null, name: `Pasted ${category}`, category, format: "leave_on", identityStatus: "unknown", inciStatus: cand.inciStatus ?? "partial", source: "paste", ingredients: cand.ingredients, placement };
  const add = await api(jar, "POST", "/api/shelf", { draft });
  return { ok: add.status === 201 || add.json?.duplicate, candidate: cand, actives: [...new Set((cand.ingredients || []).filter((i) => i.activeClass).map((i) => i.activeClass))] };
}
function analyseRota(rotaRes) {
  const body = rotaRes?.json ?? rotaRes; // accept the api() envelope {status,json} or a raw body
  const days = body?.rota?.days ?? [];
  const scheduled = new Set();
  const pmDaysByClass = {}; // activeClass -> Set(dayIndex)
  const sessionActives = [];
  const amSpfOrder = [], pmSpfViolations = [];
  let stepsWithReason = 0, stepsTotal = 0;
  for (const d of days) for (const sess of ["am", "pm"]) {
    const steps = d[sess] ?? [];
    const sunIdx = steps.flatMap((p, i) => p.category === "sunscreen" ? [i] : []);
    if (sess === "am" && sunIdx.length) amSpfOrder.push(sunIdx.every((idx) => idx === steps.length - 1));
    if (sess === "pm" && sunIdx.length) pmSpfViolations.push(d.index);
    const classes = [];
    for (const step of steps) {
      stepsTotal++;
      if (step.activeClass) { scheduled.add(step.activeClass); classes.push(step.activeClass); if (sess === "pm") (pmDaysByClass[step.activeClass] ??= new Set()).add(d.index); }
      if (step.reason || step.label || step.why) stepsWithReason++;
    }
    if (classes.length) sessionActives.push({ day: d.index, sess, classes });
  }
  return { id: body?.rota?.id, days, scheduled, pmDaysByClass, sessionActives, amSpfOrder, pmSpfViolations, stepsWithReason, stepsTotal };
}
const pushResult = (shelf, label, added, a, checks) => {
  const failed = Object.entries(checks).filter(([, c]) => c && !c.pass);
  results.push({ shelf, label, added, recognisedActives: added.flatMap((x) => x.actives || []), scheduledActives: [...(a?.scheduled ?? [])], rotaDays: a?.days?.length ?? 0, checks, pass: failed.length === 0 });
};

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
    const draft = { brand: cat.brand, name: cat.name, category: cat.category, format: cat.format ?? "unknown", identityStatus: "user_confirmed", inciStatus: cat.inciStatus ?? "partial", source: "search", catalogueId: cat.catalogueId, ingredients: cat.ingredients, placement: p.category === "sunscreen" ? "am" : "pm" };
    const add = await api(jar, "POST", "/api/shelf", { draft });
    added.push({ name: cat.name, category: cat.category, saved: add.status === 201 || add.json?.duplicate, actives: [...new Set(cat.ingredients.filter((i) => i.activeClass).map((i) => i.activeClass))] });
  }
  const rota = await api(jar, "POST", "/api/rotas", { idempotencyKey: `redteam-${shelf.id}-${Date.now() % 1e7}`, context: {} });
  const days = rota.json?.rota?.days ?? [];
  // collect scheduled actives + whether any step carries an attached reason/label
  const scheduledActives = new Set();
  let stepsWithReason = 0, stepsTotal = 0;
  const sessionActives = [];
  const amSpfOrder = [];
  const pmSpfViolations = [];
  for (const d of days) {
    for (const sess of ["am", "pm"]) {
      const sessionSteps = d[sess] ?? [];
      const sunscreenIndices = sessionSteps.flatMap((p, i) => p.category === "sunscreen" ? [i] : []);
      if (sess === "am" && sunscreenIndices.length) {
        amSpfOrder.push(sunscreenIndices.every((idx) => idx === sessionSteps.length - 1));
      }
      if (sess === "pm" && sunscreenIndices.length) pmSpfViolations.push(d.index);
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
  if (shelf.expect.basicOrderSpfLastAM) {
    checks["sunscreen appears last in AM and not PM"] = {
      pass: amSpfOrder.length > 0 && amSpfOrder.every(Boolean) && pmSpfViolations.length === 0,
      got: `SPF AM sessions=${amSpfOrder.length}, order violations=${amSpfOrder.filter((x) => !x).length}, PM violations=${pmSpfViolations.length}`,
    };
  }
  if (shelf.expect.neverSameSession) {
    const violation = sessionActives.find((s) => shelf.expect.strongActives.filter((a) => s.classes.includes(a)).length >= 2);
    checks["strong actives never same session"] = { pass: scheduledActives.size > 0 && !violation, got: violation ? `BOTH in day${violation.day} ${violation.sess}` : (scheduledActives.size ? "ok" : "n/a (none scheduled)") };
  }
  const failed = Object.entries(checks).filter(([, c]) => c && !c.pass);
  results.push({ shelf: shelf.id, label: shelf.label, added, recognisedActives: [...recognisedActives], scheduledActives: [...scheduledActives], rotaDays: days.length, checks, pass: failed.length === 0 });
}

// ===================== Issue #19 extended scenarios (added 2026-10-11) =====================
const CAT = {
  retinol: "obf:5061087560738",        // Inkey retinol
  lactic: "obf:0769915190373",         // Ordinary Lactic Acid 10% (AHA)
  cerave: "obf:3337875598996",         // CeraVe moisturising cream (no actives)
  vitcSerum: "obf:5060879821989",      // Inkey B,C,E (vitamin C)
  shiseido: { id: "brand:shiseido:clear-sunscreen-stick:us:0195106524069", barcode: "0195106524069" },
};

// catalogue-path (complements engine-live.mjs D) — pasted INCI with no catalogue identity: actives recognised from the text.
{
  const jar = cookieJar();
  await api(jar, "POST", "/api/auth/sign-in/anonymous", {});
  const paste = await addPaste(jar, "Aqua, Glycerin, Niacinamide, Salicylic Acid, Phenoxyethanol", "treatment", "pm");
  await addCatalogue(jar, { brand: "CeraVe", name: "Moisturising Cream", category: "moisturiser", format: "leave_on", inciStatus: "partial", catalogueId: CAT.cerave, ingredients: [] }, "pm");
  const a = analyseRota(await api(jar, "POST", "/api/rotas", { idempotencyKey: `x-paste-${Date.now() % 1e7}`, context: {} }));
  pushResult("cat-paste-bha-niacinamide", "pasted INCI (no SKU) → actives recognised + scheduled", [{ name: "Pasted treatment", category: "treatment", actives: paste.actives }], a, {
    "paste actives recognised server-side": { pass: paste.actives.includes("bha") || paste.actives.includes("niacinamide"), got: paste.actives.join(",") || "(none)" },
    "rota schedules the pasted active": { pass: a.scheduled.has("bha") || a.scheduled.has("niacinamide"), got: [...a.scheduled].join(",") || "NONE" },
    "steps carry reasons": { pass: a.stepsWithReason > 0, got: `${a.stepsWithReason}/${a.stepsTotal}` },
  });
}

// catalogue-path (complements engine-live.mjs E) — Shiseido sunscreen (sourced from the photographed Drug Facts label): UV
// recognised, SPF last in AM, and the missing INCI never invents other actives.
{
  const jar = cookieJar();
  await api(jar, "POST", "/api/auth/sign-in/anonymous", {});
  const shi = await resolveCatalogue(jar, CAT.shiseido.id, CAT.shiseido.barcode);
  const shiActives = shi ? [...new Set(shi.ingredients.filter((i) => i.activeClass).map((i) => i.activeClass))] : [];
  if (shi) await addCatalogue(jar, shi, "am");
  const cer = await resolveCatalogue(jar, CAT.cerave);
  if (cer) await addCatalogue(jar, cer, "pm");
  const a = analyseRota(await api(jar, "POST", "/api/rotas", { idempotencyKey: `x-shiseido-${Date.now() % 1e7}`, context: {} }));
  const nonUv = [...a.scheduled].filter((c) => c !== "uv_filter");
  pushResult("cat-shiseido-no-invented-actives", "Shiseido SPF (Drug Facts) + CeraVe — UV recognised, SPF last AM, nothing invented", [{ name: shi?.name ?? "Shiseido (NOT RESOLVED)", category: "sunscreen", actives: shiActives }], a, {
    "Shiseido resolved from catalogue": { pass: !!shi, got: shi ? shi.catalogueId : "NOT FOUND" },
    "UV filter recognised": { pass: shiActives.includes("uv_filter"), got: shiActives.join(",") || "(none)" },
    "SPF appears last in AM and never PM": { pass: a.amSpfOrder.length > 0 && a.amSpfOrder.every(Boolean) && a.pmSpfViolations.length === 0, got: `AM sessions=${a.amSpfOrder.length}, order violations=${a.amSpfOrder.filter((x) => !x).length}, PM violations=${a.pmSpfViolations.length}` },
    "no non-UV actives invented from missing INCI": { pass: nonUv.length === 0, got: nonUv.length ? `INVENTED ${nonUv.join(",")}` : "ok" },
  });
}

// catalogue-path (complements engine-live.mjs F) — retinoid + exfoliant: both scheduled, never the same session, on separate nights.
{
  const jar = cookieJar();
  await api(jar, "POST", "/api/auth/sign-in/anonymous", {});
  for (const id of [CAT.retinol, CAT.lactic, CAT.cerave]) { const c = await resolveCatalogue(jar, id); if (c) await addCatalogue(jar, c, c.category === "moisturiser" ? "pm" : "pm"); }
  const a = analyseRota(await api(jar, "POST", "/api/rotas", { idempotencyKey: `x-sep-${Date.now() % 1e7}`, context: {} }));
  const sameSession = a.sessionActives.find((s) => s.classes.includes("retinoid") && s.classes.includes("aha"));
  const retNights = a.pmDaysByClass.retinoid ?? new Set();
  const ahaNights = a.pmDaysByClass.aha ?? new Set();
  const sharedNight = [...retNights].some((d) => ahaNights.has(d));
  pushResult("cat-retinol-lactic-never-same-session", "retinol + lactic acid (AHA) + CeraVe — both scheduled on separate nights", [{ name: "Inkey Retinol / Ordinary Lactic Acid", category: "treatment", actives: ["retinoid", "aha"] }], a, {
    "both strong actives scheduled": { pass: a.scheduled.has("retinoid") && a.scheduled.has("aha"), got: [...a.scheduled].join(",") || "NONE" },
    "never in the same session": { pass: !sameSession, got: sameSession ? `BOTH in day${sameSession.day} ${sameSession.sess}` : "ok" },
    "on separate PM nights (disjoint days)": { pass: retNights.size > 0 && ahaNights.size > 0 && !sharedNight, got: `retinoid nights=[${[...retNights]}], aha nights=[${[...ahaNights]}]` },
  });
}

console.log("==== live-API shelf acceptance (baseline + Issue #19 extended) ====\n");
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
