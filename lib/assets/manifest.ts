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
    alt: "Woman applying face cream while looking in a mirror",
    rights: "licensed",
    src: "https://images.pexels.com/photos/7269486/pexels-photo-7269486.jpeg?auto=compress&cs=tinysrgb&w=1200",
    licence: "Pexels free licence; photo by Anete Lusina; https://www.pexels.com/photo/7269486/; no endorsement implied",
    expires: "none",
  },
  inviteHero: {
    id: "PH-02",
    filename: "invite-friends-4x5.jpg",
    usage: "Invite landing (/i/[token])",
    aspect: "4 / 5",
    crop: "4:5; two faces in upper 60%, inviter chip sits top-left",
    brief: "Two friends, darker skin, candid and warm",
    alt: "Two Black women laughing together",
    rights: "licensed",
    src: "https://images.pexels.com/photos/6579978/pexels-photo-6579978.jpeg?auto=compress&cs=tinysrgb&w=1200",
    licence: "Pexels free licence; photo by Alex Starnes; https://www.pexels.com/photo/6579978/; no endorsement implied",
    expires: "none",
  },
  milestone: {
    id: "PH-03",
    filename: "rota-complete-4x5.jpg",
    usage: "Rota complete (/week/complete)",
    aspect: "4 / 5",
    crop: "4:5; subject left of centre, ring disc overlaps bottom-right",
    brief: "Milestone portrait, darker skin, warm daylight",
    alt: "Woman applying moisturiser during her skincare routine",
    rights: "licensed",
    src: "https://images.pexels.com/photos/5938600/pexels-photo-5938600.jpeg?auto=compress&cs=tinysrgb&w=1200",
    licence: "Pexels free licence; photo by Sora Shimazaki; https://www.pexels.com/photo/5938600/; no endorsement implied",
    expires: "none",
  },
  shareStory: {
    id: "PH-04",
    filename: "share-story-9x16.jpg",
    usage: "Optional 9:16 share background",
    aspect: "9 / 16",
    crop: "9:16; faces clear of bottom 20%",
    brief: "Same art direction as PH-01; must be cleared for social and paid use",
    alt: "Woman cleansing her face with a cotton pad",
    rights: "licensed",
    src: "https://images.pexels.com/photos/7269467/pexels-photo-7269467.jpeg?auto=compress&cs=tinysrgb&w=1200",
    licence: "Pexels free licence; photo by Anete Lusina; https://www.pexels.com/photo/7269467/; no endorsement implied",
    expires: "none",
  },
  ogImage: {
    id: "PH-05",
    filename: "og-1200x630.jpg",
    usage: "Link preview (OG 1.91:1)",
    aspect: "1.91 / 1",
    crop: "1.91:1; subject right third, wordmark left",
    brief: "Same art direction as PH-01",
    alt: "Woman applying moisturiser",
    rights: "licensed",
    src: "https://images.pexels.com/photos/5938589/pexels-photo-5938589.jpeg?auto=compress&cs=tinysrgb&w=1400",
    licence: "Pexels free licence; photo by Sora Shimazaki; https://www.pexels.com/photo/5938589/; no endorsement implied",
    expires: "none",
  },
} satisfies Record<string, PhotoAsset>;

export type PhotoAssetKey = keyof typeof PHOTO_ASSETS;
