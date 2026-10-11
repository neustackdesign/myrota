import { bindings, defineConfig, defineWorker } from "cf/config";

/**
 * Mode-aware Cloudflare target. `@vinext/cloudflare deploy` and the vite plugin
 * read ONLY this file (never wrangler.*.jsonc), so the target must be selected
 * here by mode:
 *
 *   - default mode (no --mode / --env): production `myrota` Worker + `myrota` D1.
 *     Output is identical to the pre-2026-10-11 config. Production is frozen;
 *     the npm deploy scripts refuse to deploy it (see scripts/deploy-staging.mjs).
 *   - mode "staging": `myrota-staging` Worker + `myrota-staging` D1 + the Workers
 *     AI binding and the staging photo-reading flag. Deploy ONLY via
 *     `npm run deploy:staging`, which verifies this resolution fail-closed.
 *
 * Staging photo reading needs BOTH `AI` and PHOTO_READING_ENABLED=1
 * (lib/server/capabilities.ts). Before this file declared them, a vinext deploy
 * to staging silently dropped the AI binding and /api/config reported
 * photoReading:false. Extract quotas (lib/server/extract-quota.ts) still apply.
 */
const PRODUCTION_WORKER = "myrota";
const STAGING_WORKER = "myrota-staging";

const shared = {
  entrypoint: "vinext/server/fetch-handler",
  compatibilityDate: "2026-09-28",
  compatibilityFlags: ["nodejs_compat"],
  assets: { notFoundHandling: "none" as const },
};

export default defineConfig(({ mode }) => {
  if (mode === "staging") {
    return {
      accountId: "3f005671e25afcd90290134132bc1fa2",
      worker: defineWorker({
        ...shared,
        name: STAGING_WORKER,
        env: {
          ASSETS: bindings.assets(),
          DB: bindings.d1({ name: "myrota-staging" }),
          AI: bindings.ai(),
          // Staging-only operator flag; production keeps photo reading gated.
          PHOTO_READING_ENABLED: bindings.text("1"),
          MYROTA_VISION_MODEL: bindings.text("@cf/mistralai/mistral-small-3.1-24b-instruct"),
          MYROTA_VISION_FORMAT: bindings.text("messages"),
        },
      }),
    };
  }
  return {
    accountId: "3f005671e25afcd90290134132bc1fa2",
    worker: defineWorker({
      ...shared,
      name: PRODUCTION_WORKER,
      env: {
        ASSETS: bindings.assets(),
        // cf reuses an existing D1 resource with this name in the selected account.
        DB: bindings.d1({ name: "myrota" }),
      },
    }),
  };
});
