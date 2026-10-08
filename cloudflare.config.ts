import { bindings, defineConfig, defineWorker } from "cf/config";

export default defineConfig({
  accountId: "3f005671e25afcd90290134132bc1fa2",
  worker: defineWorker({
    name: "myrota",
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-09-28",
    compatibilityFlags: ["nodejs_compat"],
    assets: { notFoundHandling: "none" },
    env: {
      ASSETS: bindings.assets(),
      // cf reuses an existing D1 resource with this name in the selected account.
      DB: bindings.d1({ name: "myrota" }),
    },
  }),
});
