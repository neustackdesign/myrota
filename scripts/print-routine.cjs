/* Offline routine print using the compiled pure scheduler (.domain-test).
 * Run `npm run test:domain` first to compile, then: node scripts/print-routine.cjs */
const { buildRota, daysWith } = require("../.domain-test/lib/domain/scheduler.js");

let seq = 0;
const partial = (id, name, category, actives, placement = "pm") => ({
  id, brand: "Brand", name, category, format: "leave_on",
  identityStatus: "user_confirmed", inciStatus: "partial", identityKey: null, variant: null,
  ingredients: [
    { id: `u${(seq += 1)}`, text: "Aqua", normalized: "aqua", status: "read", activeClass: null },
    ...actives.map((a) => ({ id: `a${(seq += 1)}`, text: a, normalized: a, status: "read", activeClass: a })),
  ],
  labelActives: [], flags: [], placement, source: "search",
  createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-01T00:00:00.000Z",
});

const EMPTY = { version: "pending-pharmacist-review", pairRules: [], timingRules: [], contextHoldRules: [] };
const SHELVES = [
  { id: "A", label: "retinoid + exfoliant", products: [
    partial("ret", "Inkey Retinol", "serum", ["retinoid"]),
    partial("lac", "Ordinary Lactic Acid 10%", "treatment", ["aha"]),
    partial("cera", "CeraVe Cream", "moisturiser", []),
  ]},
  { id: "B", label: "PHA + SPF + moisturiser", products: [
    partial("pha", "Minimalist PHA Toner", "toner", ["pha"]),
    partial("spf", "Anthelios SPF", "sunscreen", ["uv_filter"], "am"),
    partial("cera", "CeraVe Cream", "moisturiser", []),
  ]},
  { id: "C", label: "vitamin C / niacinamide", products: [
    partial("bce", "Inkey B,C,E Moisturiser", "moisturiser", ["vitamin_c", "niacinamide"]),
    partial("gar", "Garnier Vitamin C", "moisturiser", ["niacinamide"]),
    partial("cera", "CeraVe Cream", "moisturiser", []),
  ]},
];

for (const shelf of SHELVES) {
  const rota = buildRota({
    rotaId: `print-${shelf.id}`, weekNumber: 1, startDate: "2026-10-12", timeZone: "Africa/Lagos",
    createdAt: "2026-10-12T06:00:00.000Z", products: shelf.products, context: {}, ruleSet: EMPTY, accepted: ["reviewed"],
  });
  console.log(`\n==== SHELF ${shelf.id} — ${shelf.label} ====`);
  console.log(`held: ${rota.held.map((h) => `${h.productId}:${h.reason}`).join(", ") || "(none)"}`);
  for (const p of shelf.products) console.log(`  ${p.name} → days ${daysWith(rota, p.id).join(",") || "—"}`);
  for (const d of rota.days) {
    const fmt = (s) => `${s.displayName}${s.activeClass ? `[${s.activeClass}]` : ""}${s.label ? `<${s.label}>` : ""}`;
    console.log(`  D${d.index} ${d.type.padEnd(9)} AM: ${d.am.map(fmt).join(" → ") || "—"}  |  PM: ${d.pm.map(fmt).join(" → ") || "—"}`);
  }
  const seen = new Set();
  console.log("  reasons:");
  for (const d of rota.days) for (const s of [...d.am, ...d.pm]) if (s.reason && !seen.has(s.reason)) { seen.add(s.reason); console.log(`    • ${s.reason}`); }
}
