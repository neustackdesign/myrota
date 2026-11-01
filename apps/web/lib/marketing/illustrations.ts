/**
 * Promotional illustration slots. Never substitute unlicensed brand art or
 * pretend missing commissioned work has been supplied.
 *
 * Replace a slot by committing a file into public/illustrations and documenting
 * permission to use it. Every production slot must have "approved" status.
 * This is editorial/creative content, NOT a catalogue of skincare rules.
 */
export interface PromotionalIllustration {
  slot: "shelf" | "friends" | "morning" | "evening";
  usage: string;
  filename: string;
  description: string;
  status: "missing" | "review" | "approved";
  src?: string;
  alt: string;
  rightsNote?: string;
}
export const PROMOTIONAL_ILLUSTRATIONS: Record<PromotionalIllustration["slot"], PromotionalIllustration> = {
  shelf: {
    slot: "shelf",
    usage: "Empty Shelf and promotional onboarding",
    filename: "rotaspot-shelf.svg",
    description: "Original myrota RotaSpot shelf character/artwork; Brand v4 master",
    status: "missing",
    alt: "Illustration of a skincare shelf",
  },
  friends: {
    slot: "friends",
    usage: "Friends empty state and invitation promotional assets",
    filename: "rotaspot-friends.svg",
    description: "Original myrota RotaSpot friendship character/artwork",
    status: "missing",
    alt: "Illustration of two friends sharing a skincare streak",
  },
  morning: {
    slot: "morning",
    usage: "Morning routine education and campaign cards",
    filename: "rotaspot-morning.svg",
    description: "Original myrota morning illustration",
    status: "missing",
    alt: "Illustration of a morning skincare routine",
  },
  evening: {
    slot: "evening",
    usage: "Evening routine education and campaign cards",
    filename: "rotaspot-evening.svg",
    description: "Original myrota evening illustration",
    status: "missing",
    alt: "Illustration of an evening skincare routine",
  },
};
