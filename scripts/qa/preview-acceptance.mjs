#!/usr/bin/env node
/**
 * Live acceptance for the myrota Vercel Preview → same-origin /api proxy →
 * live Cloudflare Worker → production D1. Uses the REAL Turnstile widget:
 * run it headed on a person's machine so a human can complete any challenge.
 *
 *   npm i -D playwright@1.56.1 && npx playwright install chromium   # once
 *   node scripts/qa/preview-acceptance.mjs <preview-url>
 *
 * Protected Preview: provide the Vercel shareable-link token via the
 * VERCEL_SHARE_TOKEN environment variable or the hidden prompt. Never pass
 * it as an argument (shell history) and never commit or paste it.
 *
 * Creates two anonymous guest users with three clearly-labelled test
 * products ("QA …") and one rota in the live D1. Prints no cookies, tokens
 * or user IDs; rota IDs are reported as a short hash.
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const [BASE_RAW, extra] = process.argv.slice(2);
if (!BASE_RAW) { console.error("usage: preview-acceptance.mjs <preview-url>   (share token via VERCEL_SHARE_TOKEN or prompt)"); process.exit(2); }
if (extra) { console.error("Refusing a share token on the command line; use VERCEL_SHARE_TOKEN or the prompt."); process.exit(2); }
async function hiddenPrompt(q) {
  if (!process.stdin.isTTY) return "";
  process.stdout.write(q);
  return await new Promise((resolve) => {
    let v = ""; process.stdin.setRawMode(true); process.stdin.resume(); process.stdin.setEncoding("utf8");
    const on = (ch) => {
      if (ch === "\r" || ch === "\n" || ch === "\u0004") { process.stdin.setRawMode(false); process.stdin.pause(); process.stdin.off("data", on); process.stdout.write("\n"); resolve(v.trim()); }
      else if (ch === "\u0003") process.exit(130);
      else v += ch;
    };
    process.stdin.on("data", on);
  });
}
const SHARE = process.env.VERCEL_SHARE_TOKEN || (await hiddenPrompt("Vercel share token (Enter to skip if the Preview is not protected): "));
const BASE = BASE_RAW.replace(/\/$/, "");
const OUT = `qa-evidence/${new Date().toISOString().replace(/[:.]/g, "-")}`;
mkdirSync(OUT, { recursive: true });
const results = [];
const ok = (name, pass, detail = "") => { results.push({ name, pass, detail }); console.log(`${pass ? "PASS" : "FAIL"} ${name}${detail ? " — " + detail : ""}`); };
const short = (s) => (s ? createHash("sha256").update(s).digest("hex").slice(0, 10) : "none");

async function context(browser) {
  const c = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "en-GB" });
  if (SHARE) { const p = await c.newPage(); await p.goto(`${BASE}/?_vercel_share=${encodeURIComponent(SHARE)}`); await p.close(); }
  return c;
}
const api = (p, path, init) => p.evaluate(async ([path, init]) => { const r = await fetch(path, init); let body = null; try { body = await r.json(); } catch {} return { status: r.status, body }; }, [path, init ?? {}]);

async function waitWrite(p, label) {
  // A first write triggers the real Turnstile widget. If it needs a human, it appears bottom-right.
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    if (await p.getByText("Your shelf so far").isVisible().catch(() => false)) return true;
    if (await p.locator('iframe[src*="challenges.cloudflare.com"]').isVisible().catch(() => false)) console.log(`>> ${label}: complete the Turnstile check in the browser window…`);
    await p.waitForTimeout(1500);
  }
  return false;
}

const browser = await chromium.launch({ headless: false });
const A = await context(browser);
const p = await A.newPage();
const errors = []; p.on("pageerror", (e) => errors.push(e.message));
const calls = []; p.on("response", (r) => { const u = new URL(r.url()); if (u.pathname.startsWith("/api/")) calls.push(`${r.request().method()} ${u.pathname} ${r.status()}`); });

await p.goto(`${BASE}/`);
ok("landing renders", await p.getByText("in order.").first().isVisible({ timeout: 20000 }).catch(() => false));
await p.screenshot({ path: `${OUT}/01-landing.png` });
await p.goto(`${BASE}/app?src=qa`);
await p.getByText("Add my products").waitFor({ timeout: 30000 });
ok("/app welcome; no session created on view", !calls.some((c) => c.includes("/api/auth/sign-in")));
await p.getByText("Add my products").click();
const search = p.locator("#myrota-product-name");
await search.fill("QA gentle cleanser");
await p.getByText("Add “QA gentle cleanser”").click();
await p.getByRole("button", { name: "Morning" }).click();
await p.getByText("Add to shelf as unknown").click();
ok("product 1 saved (Turnstile + anonymous session + POST /api/shelf)", await waitWrite(p, "first save"), calls.filter((c) => /auth|shelf/.test(c)).join(", "));
const me = await api(p, "/api/me");
ok("session cookie works through the Vercel /api proxy", me.status === 200 && me.body?.isAnonymous === true, `GET /api/me ${me.status}`);
await p.getByRole("button", { name: "Paste ingredient list" }).click();
await p.locator("textarea").fill("Aqua, Glycerin, Cetearyl Alcohol, Butyrospermum Parkii Butter, Dimethicone");
await p.getByText("Read ingredients").click();
await p.getByText("Is this it?").waitFor({ timeout: 20000 });
await p.locator("input").first().fill("QA shea night cream");
await p.getByRole("button", { name: "Moisturiser" }).click();
await p.getByText("That's it").click();
await p.getByText("Add to shelf", { exact: true }).click();
await p.getByRole("button", { name: "Evening" }).click();
await p.getByRole("button", { name: "Add to shelf" }).last().click();
await p.waitForTimeout(2500);
await search.fill("QA SPF 50");
await p.getByText("Add “QA SPF 50”").click();
await p.getByRole("button", { name: "Morning" }).click();
await p.getByText("Add to shelf as unknown").click();
await p.waitForTimeout(2500);
await p.reload();
await p.getByText("Your shelf so far").waitFor({ timeout: 20000 });
const shelf = await api(p, "/api/shelf");
ok("three products persist after refresh", shelf.body?.products?.length === 3, (shelf.body?.products ?? []).map((x) => `${x.name}:${x.identityStatus}/${x.inciStatus}`).join(" | "));
await p.screenshot({ path: `${OUT}/02-shelf.png` });
await p.getByText("Build my rota").click();
await p.getByText("Start my streak").waitFor({ timeout: 30000 });
await p.screenshot({ path: `${OUT}/03-reveal.png` });
const r1 = await api(p, "/api/rotas/current");
ok("rota created in live D1", !!r1.body?.rota?.id, `rota#${short(r1.body?.rota?.id)}`);
await p.getByText("Start my streak").click();
const dock = p.getByText(/Mark (morning|evening) done|Rest day done/);
await dock.waitFor({ timeout: 20000 });
const first = (await dock.textContent()).trim();
await dock.dblclick();
await p.waitForTimeout(3000);
let today = await api(p, "/api/today");
const rec = () => (today.body?.records ?? []).find((x) => x.rotaId === r1.body?.rota?.id);
ok(`"${first}" double-tap records exactly one event`, rec()?.events?.length === 1, `events=${rec()?.events?.length}`);
const second = p.getByText(/Mark (morning|evening) done/);
if (await second.isVisible().catch(() => false)) {
  const label = (await second.textContent()).trim();
  await second.click();
  await p.waitForTimeout(3000);
  today = await api(p, "/api/today");
  ok(`"${label}" recorded (AM + PM both stored)`, rec()?.events?.length === 2, `events=${rec()?.events?.length}`);
}
await p.reload();
await p.waitForTimeout(3000);
await p.screenshot({ path: `${OUT}/04-today-after-reload.png` });
const r2 = await api(p, "/api/rotas/current");
ok("same rota after refresh", r2.body?.rota?.id === r1.body?.rota?.id);
const again = await api(p, "/api/rotas", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ idempotencyKey: `qa-second-${Date.now()}`, context: {} }) });
ok("second create returns the existing active rota", again.body?.rota?.id === r1.body?.rota?.id, `status ${again.status}`);
await p.goto(`${BASE}/app/mix?a=Retinoid&b=BHA%20exfoliant&src=qa`);
await p.getByText("Check the mix").click({ timeout: 20000 });
ok("Mix Check → Not enough evidence", await p.getByText("Not enough evidence").first().isVisible({ timeout: 20000 }).catch(() => false));
await p.screenshot({ path: `${OUT}/05-mix.png` });

const B = await context(browser);
const q = await B.newPage();
await q.goto(`${BASE}/app`);
await q.getByText("Add my products").waitFor({ timeout: 30000 });
const iso = {
  me: (await api(q, "/api/me")).status,
  shelf: (await api(q, "/api/shelf")).status,
  foreignCompletion: (await api(q, "/api/completions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ rotaId: r1.body?.rota?.id, skincareDate: today.body?.records?.[0]?.skincareDate ?? "2026-10-09", session: "am", idempotencyKey: `qa-foreign-${Date.now()}` }) })).status,
};
ok("second browser isolated (no session; shelf 401; foreign completion rejected)", iso.me === 401 && iso.shelf === 401 && [401, 403, 404].includes(iso.foreignCompletion), JSON.stringify(iso));
ok("no uncaught page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
writeFileSync(`${OUT}/results.json`, JSON.stringify({ base: BASE, at: new Date().toISOString(), results, apiCalls: calls }, null, 1));
console.log(`\n${results.filter((r) => r.pass).length}/${results.length} passed · evidence in ${OUT}/`);
await browser.close();
