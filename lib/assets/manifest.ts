/**
 * Production photography manifest. A slot renders an image ONLY when its entry
 * has `rights: "licensed"` and a `src`; otherwise PhotoSlot shows an explicit
 * "missing licensed asset" plate. Never point `src` at unlicensed or copied
 * competitor imagery. Mirror of docs/ASSET_MANIFEST.md.
 */
export type RightsStatus = "missing" | "licensed";

export interface PhotoAsset {
  id: string;
  /** Exact filename expected under /public/photos once supplied. */
  filename: string;
  usage: string;
  /** CSS aspect-ratio of the slot. */
  aspect: string;
  crop: string;
  brief: string;
  alt: string;
  rights: RightsStatus;
  src?: string;
  licence?: string;
  expires?: string;
}

export const PHOTO_ASSETS = {
  landingHero: {
    id: "PH-01",
    filename: "landing-hero-4x5.jpg",
    usage: "Landing hero (/)",
    aspect: "4 / 5",
    crop: "4:5 portrait; face in upper 60%, nothing critical in bottom 20% where plates sit",
    brief: "Darker-skin close-up, natural light, real texture, no pore-removing retouch",
    alt: "Close-up portrait of a person with deep brown skin in warm daylight",
    rights: "missing",
  },
  inviteHero: {
    id: "PH-02",
    filename: "invite-friends-4x5.jpg",
    usage: "Invite landing (/i/[token])",
    aspect: "4 / 5",
    crop: "4:5; two faces in upper 60%, inviter chip sits top-left",
    brief: "Two friends, darker skin, candid and warm",
    alt: "Two friends laughing together in warm light",
    rights: "missing",
  },
  milestone: {
    id: "PH-03",
    filename: "rota-complete-4x5.jpg",
    usage: "Rota complete (/week/complete)",
    aspect: "4 / 5",
    crop: "4:5; subject left of centre, ring disc overlaps bottom-right",
    brief: "Milestone portrait, darker skin, warm daylight",
    alt: "Portrait of a smiling person with dark skin in morning light",
    rights: "missing",
  },
  shareStory: {
    id: "PH-04",
    filename: "share-story-9x16.jpg",
    usage: "Optional 9:16 share background",
    aspect: "9 / 16",
    crop: "9:16; faces clear of bottom 20%",
    brief: "Same art direction as PH-01; must be cleared for social and paid use",
    alt: "",
    rights: "missing",
  },
  ogImage: {
    id: "PH-05",
    filename: "og-1200x630.jpg",
    usage: "Link preview (OG 1.91:1)",
    aspect: "1.91 / 1",
    crop: "1.91:1; subject right third, wordmark left",
    brief: "Same art direction as PH-01",
    alt: "",
    rights: "missing",
  },
} satisfies Record<string, PhotoAsset>;

export type PhotoAssetKey = keyof typeof PHOTO_ASSETS;
