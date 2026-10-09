import { PHOTO_ASSETS, type PhotoAssetKey } from "./manifest";

/**
 * Design image-slot register (Landing (1) + Prototype v1.6) → licensed asset.
 * A slot without an asset renders only its designed Grain field (never an
 * empty box or a diagnostic). Mirror of docs/ASSET_MANIFEST.md §v1.6 slots.
 *
 * `review: "pending"` = rights recorded from Pexels licence metadata in PR #4,
 * but the crop/visual fit to this slot's brief has not been signed off and the
 * file is still served from the Pexels CDN rather than self-hosted.
 */
export interface SlotAsset {
  asset: PhotoAssetKey;
  /** CSS object-position focal point for this slot's crop. */
  focus: string;
  review: "pending" | "approved";
}

export const IMAGE_SLOTS: Record<string, SlotAsset | null> = {
  // Landing
  "lp4-shot1": { asset: "landingHero", focus: "50% 30%", review: "pending" },
  "lp4-shot2": { asset: "ogImage", focus: "60% 45%", review: "pending" },
  "lp4-shot3": null,
  "lp4-shot4": { asset: "inviteHero", focus: "50% 35%", review: "pending" },
  "lp4-shot5": null,
  "lp4-shot6": { asset: "milestone", focus: "45% 40%", review: "pending" },
  "lp4-shot7": null,
  "lp4-shot9": null,
  "lp4-shot10": { asset: "shareStory", focus: "50% 35%", review: "pending" },
  // PWA
  "photo-welcome": { asset: "landingHero", focus: "50% 30%", review: "pending" },
  "photo-rota-complete": { asset: "milestone", focus: "40% 35%", review: "pending" },
  "photo-invite": { asset: "inviteHero", focus: "50% 35%", review: "pending" },
  "share-ring-window": { asset: "shareStory", focus: "50% 40%", review: "pending" },
  "share-day3": null,
  "share-friend": { asset: "inviteHero", focus: "50% 35%", review: "pending" },
};

export function slotImage(slot: string) {
  const s = IMAGE_SLOTS[slot];
  if (!s) return null;
  const a = PHOTO_ASSETS[s.asset];
  if (a.rights !== "licensed" || !a.src) return null;
  return { src: a.src, alt: a.alt, focus: s.focus };
}
