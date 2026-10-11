#!/usr/bin/env node
// Guard: confirm the resolved Worker config targets staging, not production.
// deploy:staging runs this AFTER the build and BEFORE `@vinext/cloudflare deploy`
// (which resolves the same cloudflare.config.ts). Abort on any mismatch so engine
// code can never reach the production `myrota` Worker again (2026-10-11 incident).
const EXPECT = {
  name: "myrota-staging",
  d1Name: "myrota-staging",
  d1Id: "c003a749-1f1a-454e-aad9-bedd067cc7b1",
};

process.env.MYROTA_TARGET = "staging";
const { default: config } = await import("../cloudflare.config.ts");
const w = config?.worker ?? {};
const db = w.env?.DB ?? {};

const fail = (msg) => {
  console.error(`ABORT: ${msg}`);
  process.exit(1);
};

if (w.name !== EXPECT.name) fail(`Worker name is "${w.name}", expected "${EXPECT.name}".`);
if (db.type !== "d1") fail(`DB binding type is "${db.type}", expected "d1".`);
if (db.name !== EXPECT.d1Name) fail(`D1 name is "${db.name}", expected "${EXPECT.d1Name}".`);
if (db.id !== EXPECT.d1Id) fail(`D1 id is "${db.id}", expected "${EXPECT.d1Id}".`);

console.log(`OK: Worker "${w.name}" → D1 "${db.name}" (${db.id}). Safe to deploy to staging.`);
