#!/usr/bin/env node
/**
 * Guarded staging deploy — the ONLY supported way to deploy this branch.
 *
 *   npm run deploy:staging            # preflight → build → verify artifact → deploy → postflight
 *   npm run deploy:staging -- --dry-run   # everything except the upload
 *
 * Fail-closed at every step. It aborts if the resolved config, or the built
 * artifact that will actually be uploaded, names anything other than the
 * `myrota-staging` Worker + `myrota-staging` D1, lacks the Workers AI binding or
 * the staging photo-reading flag, or mentions the production Worker/DB at all.
 * Root cause this guards (docs/HANDOFF_2026-10-11.md §3): `@vinext/cloudflare
 * deploy` ignores `--config wrangler.staging.jsonc` and reads cloudflare.config.ts.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { loadAndParseConfig } from "@cloudflare/config";

const ROOT = process.cwd();
const MODE = "staging";
const EXPECT = { worker: "myrota-staging", db: "myrota-staging" };
const PROD = { worker: "myrota", db: "myrota" };
const STAGING_URL = process.env.MYROTA_STAGING_URL ?? "https://myrota-staging.neustackdesign.workers.dev";
const dryRun = process.argv.includes("--dry-run");

function fail(msg) {
  console.error(`\n  ✗ STAGING DEPLOY ABORTED: ${msg}\n`);
  process.exit(1);
}
function ok(msg) { console.log(`  ✓ ${msg}`); }

/** Assert a resolved worker config targets staging only. Exported shape: { name, env }. */
function assertStagingTarget(worker, where) {
  if (!worker || typeof worker !== "object") fail(`${where}: no worker config`);
  if (worker.name !== EXPECT.worker) fail(`${where}: worker name is ${JSON.stringify(worker.name)}, expected ${EXPECT.worker}`);
  const env = worker.env ?? {};
  if (env.DB?.type !== "d1" || env.DB?.name !== EXPECT.db) fail(`${where}: DB is ${JSON.stringify(env.DB)}, expected d1 ${EXPECT.db}`);
  if (env.AI?.type !== "ai") fail(`${where}: Workers AI binding missing — photo reading would report false`);
  if (env.PHOTO_READING_ENABLED?.value !== "1") fail(`${where}: PHOTO_READING_ENABLED is not "1"`);
  // No production name may appear anywhere as a worker or D1 name.
  for (const [key, b] of Object.entries(env)) {
    if (b?.type === "d1" && b.name === PROD.db) fail(`${where}: binding ${key} points at production D1 ${PROD.db}`);
  }
  if (worker.name === PROD.worker) fail(`${where}: resolves to production Worker ${PROD.worker}`);
}

function run(cmd, args) {
  console.log(`\n  $ ${cmd} ${args.join(" ")}`);
  const r = spawnSync(cmd, args, { stdio: "inherit", cwd: ROOT, env: process.env });
  if (r.status !== 0) fail(`${cmd} ${args[0] ?? ""} exited ${r.status}`);
}

async function main() {
  console.log(`\n  myrota guarded staging deploy${dryRun ? " (dry run)" : ""}`);

  // 1. Preflight: what cloudflare.config.ts resolves to in staging mode.
  const { result } = await loadAndParseConfig(path.join(ROOT, "cloudflare.config.ts"), { isPreview: false, mode: MODE });
  if (!result.success) fail(`cloudflare.config.ts invalid: ${result.error.message}`);
  assertStagingTarget(result.data.worker, "resolved config");
  ok(`config resolves to ${EXPECT.worker} / D1 ${EXPECT.db} / AI + photo flag`);

  // 2. Build in staging mode.
  run("npx", ["vite", "build", "--mode", MODE]);

  // 3. Verify the artifact that will actually be uploaded.
  const outRoot = path.join(ROOT, ".cloudflare/output/v0");
  const workerCfg = path.join(outRoot, "workers/default/worker.config.json");
  if (!existsSync(workerCfg)) fail(`build artifact missing: ${workerCfg}`);
  const built = JSON.parse(readFileSync(workerCfg, "utf8"));
  const ctx = JSON.parse(readFileSync(path.join(outRoot, "config.json"), "utf8"));
  if (ctx.buildContext?.mode !== MODE) fail(`artifact built in mode ${JSON.stringify(ctx.buildContext?.mode)}, expected ${MODE}`);
  assertStagingTarget(built, "built artifact");
  ok(`artifact verified: ${built.name}, bindings ${Object.keys(built.env).join(", ")}`);

  if (dryRun) {
    console.log("\n  Dry run: artifact verified, nothing uploaded.\n");
    return;
  }

  // 4. Deploy exactly that artifact (no rebuild) in staging mode.
  run("npx", ["vinext-cloudflare", "deploy", "--env", MODE, "--skip-build"]);

  // 5. Postflight against the live staging Worker.
  const health = await fetch(`${STAGING_URL}/api/health`).then((r) => r.json()).catch((e) => fail(`health: ${e}`));
  if (health?.database !== "connected") fail(`staging health not connected: ${JSON.stringify(health)}`);
  const config = await fetch(`${STAGING_URL}/api/config`).then((r) => r.json()).catch((e) => fail(`config: ${e}`));
  if (config?.capabilities?.photoReading !== true) {
    fail(`deployed but /api/config does not report photoReading:true: ${JSON.stringify(config)}`);
  }
  ok(`live ${STAGING_URL}: database connected, photoReading true`);
  run("npx", ["wrangler", "deployments", "status", "--name", EXPECT.worker]);
}

main().catch((e) => fail(e?.stack ?? String(e)));
