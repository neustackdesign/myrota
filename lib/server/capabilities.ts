import type { MyrotaBindings } from "./cloudflare-env";
import { catalogueSize } from "./catalogue-store";

/**
 * Server-controlled feature capabilities surfaced to the client via /api/config.
 * The client MUST treat an absent capability as disabled and must not enable a
 * flow the server says is off.
 *
 * - catalogue: on when a real local catalogue is bundled.
 * - photoReading: on ONLY when a Workers AI vision binding exists AND the server
 *   operator has set PHOTO_READING_ENABLED=1 — which happens only after the real
 *   30-label benchmark (docs/INGESTION_BENCHMARK.md) passes on the deployed model.
 *   Presence of the binding alone is never enough.
 */
export interface Capabilities {
  photoReading: boolean;
  catalogue: boolean;
}

export function capabilitiesFor(env: MyrotaBindings): Capabilities {
  return {
    catalogue: catalogueSize > 0,
    photoReading: Boolean(env.AI) && env.PHOTO_READING_ENABLED === "1",
  };
}
