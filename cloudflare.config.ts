import { bindings, defineConfig, defineWorker } from "cf/config";

// The Worker + D1 target is chosen by MYROTA_TARGET at build time. There is NO
// default: a missing/unknown value throws here so the build fails loudly rather
// than silently deploying engine code to the wrong Worker (see the 2026-10-11
// incident where a staging deploy hit production because the target was baked in).
const TARGETS = {
  staging: {
    name: "myrota-staging",
    d1: { name: "myrota-staging", id: "c003a749-1f1a-454e-aad9-bedd067cc7b1" },
  },
  pilot: {
    // Production/pilot Worker. Deploys here need a separate script and approval.
    name: "myrota",
    d1: { name: "myrota" },
  },
} as const;

const MYROTA_TARGET = process.env.MYROTA_TARGET;
if (MYROTA_TARGET !== "staging" && MYROTA_TARGET !== "pilot") {
  throw new Error(
    `MYROTA_TARGET must be "staging" or "pilot" (got ${JSON.stringify(MYROTA_TARGET)}). ` +
      `Set it explicitly — there is no default.`,
  );
}
const target = TARGETS[MYROTA_TARGET];

export default defineConfig({
  accountId: "3f005671e25afcd90290134132bc1fa2",
  worker: defineWorker({
    name: target.name,
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-09-28",
    compatibilityFlags: ["nodejs_compat"],
    assets: { notFoundHandling: "none" },
    env: {
      ASSETS: bindings.assets(),
      // cf reuses an existing D1 resource with this name/id in the selected account.
      DB: bindings.d1(target.d1),
    },
  }),
});
