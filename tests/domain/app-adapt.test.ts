/**
 * v1.6 UI adapter tests: the drawing layer must never upgrade evidence,
 * invent completion or relabel a held product as scheduled.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { designDays, designStatus, dayStatementOf, provenanceOf, sessionsFor, shelfRole, tagOf, toneOf, weekday, TRACK, SEA_GLASS } from "../../lib/app/adapt";
import { buildRota } from "../../lib/domain/scheduler";
import type { RuleSet } from "../../lib/domain/types";
import { product } from "./fixtures";

const NO_RULES: RuleSet = { version: "none", pairRules: [], timingRules: [], contextHoldRules: [] };

function pilotRota() {
  // Mirrors the deployed pilot: no reviewed clinical rules.
  const products = [
    product("cleanser", "cleanser", [], { inciStatus: "user_confirmed" }),
    product("retinal", "serum", ["retinoid"]),
    product("shea", "other", [], { inciStatus: "unknown", identityStatus: "unknown", ingredients: [], placement: "pm" }),
    product("pasted", "moisturiser", [], { inciStatus: "partial", placement: "none" }),
  ];
  const rota = buildRota({ rotaId: "r1", weekNumber: 1, startDate: "2026-10-08", timeZone: "Africa/Lagos", createdAt: "2026-10-08T08:00:00.000Z", products, context: {}, ruleSet: NO_RULES });
  return { rota, products };
}

test("adapter · with no reviewed rules every day is a Daily day and actives stay off the plan", () => {
  const { rota } = pilotRota();
  const days = designDays(rota);
  assert.equal(days.length, 7);
  assert.ok(days.every((d) => d.t === "base"), "no Retinoid/Exfoliant nights without reviewed timing rules");
  assert.ok(days.every((d) => tagOf(d) === "Daily"));
  assert.equal(dayStatementOf(days[0]), "Daily rota.");
  assert.equal(sessionsFor("retinal", days).am || sessionsFor("retinal", days).pm, false, "held active is not drawn on any session");
  assert.deepEqual(sessionsFor("shea", days), { am: false, pm: true }, "unknown product appears only where the user placed it");
  const shea = days[0].pm.find((i) => i.productId === "shea");
  assert.ok(shea && shea.role === "unknown" && !shea.analysed && shea.note.includes("not analysed"));
  assert.deepEqual(sessionsFor("pasted", days), { am: false, pm: false }, "placement 'none' keeps a partial product off the rota");
});

test("adapter · statuses never turn missed or future into done", () => {
  assert.equal(designStatus("complete", 0, 2), "done");
  assert.equal(designStatus("rest_complete", 1, 2), "done");
  assert.equal(designStatus("rescued", 1, 2), "rescued");
  assert.equal(designStatus("in_progress", 2, 2), "today");
  assert.equal(designStatus("in_progress", 1, 2), "missed", "an unfinished past day is drawn as missed, not pending");
  assert.equal(designStatus("future", 3, 2), "future");
  const day = { t: "base" as const, index: 3 };
  assert.equal(toneOf(day, "future"), TRACK);
  assert.equal(toneOf(day, "missed"), "x", "missed uses the Sienna hairline sentinel");
  assert.equal(toneOf(day, "rescued"), SEA_GLASS);
  assert.equal(toneOf({ t: "rec", index: 0 }, "done"), SEA_GLASS);
});

test("adapter · provenance reflects ingredient evidence only", () => {
  assert.equal(provenanceOf({ inciStatus: "corrected" }), "corrected");
  assert.equal(provenanceOf({ inciStatus: "partial" }), "partial");
  assert.equal(provenanceOf({ inciStatus: "unknown" }), "unknown");
  assert.equal(provenanceOf({ inciStatus: "user_confirmed" }), "user-confirmed");
  const confirmedName = product("x", "moisturiser", [], { identityStatus: "user_confirmed", inciStatus: "partial" });
  assert.equal(provenanceOf(confirmedName), "partial", "confirming the name never upgrades ingredients");
  assert.equal(shelfRole(confirmedName), "Partly read");
  assert.equal(shelfRole(product("y", "cleanser", [], { inciStatus: "unknown", ingredients: [] })), "Unknown");
});

test("adapter · weekday labels come from the skincare date, not a UTC instant", () => {
  assert.equal(weekday("2026-10-08", "long"), "Thursday");
  assert.equal(weekday("2026-10-11", "short"), "Sun");
});
