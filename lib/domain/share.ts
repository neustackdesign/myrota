import type { MixResult } from "./mix";
import type { ActiveClass, MixVerdict } from "./types";

/**
 * Share payloads. Privacy defaults:
 * - Product names and identity names are OFF by default; turning them on is an
 *   explicit opt-in that the UI always previews before sharing.
 * - Private context (pregnancy, prescription, retinoid experience) has no field
 *   here, so it cannot leak into a card.
 * - Mix cards keep evidence-backed active classes so the verdict stays
 *   meaningful without naming products. Unknown products contribute none.
 * - Every card carries a working deep link.
 */

export type ShareKind = "rota" | "mix" | "day3" | "day7" | "friend";
export type ShareFormat = "story" | "square" | "og";

export const SHARE_DIMENSIONS: Record<ShareFormat, { width: number; height: number; label: string }> = {
  story: { width: 1080, height: 1920, label: "Story 9:16" },
  square: { width: 1080, height: 1080, label: "Square" },
  og: { width: 1200, height: 630, label: "Link preview" },
};

export const ACTIVE_CLASS_LABEL: Record<ActiveClass, string> = {
  retinoid: "Retinoid",
  aha: "AHA",
  bha: "BHA",
  vitamin_c: "Vitamin C",
  niacinamide: "Niacinamide",
  azelaic_acid: "Azelaic acid",
  benzoyl_peroxide: "Benzoyl peroxide",
};

export interface ShareCardPayload {
  kind: ShareKind;
  format: ShareFormat;
  headline: string;
  subline: string;
  /** Empty unless the user opted in for a kind that allows it. */
  productNames: string[];
  /** Mix only: evidence-backed classes per product. */
  activeClasses: [ActiveClass[], ActiveClass[]] | null;
  verdict: MixVerdict | null;
  /** Relative deep link the card opens. */
  deepLink: string;
  namesShown: boolean;
}

export type ShareInput =
  | { kind: "rota"; treatmentDays: number; recoveryDays: number; productNames: string[] }
  | { kind: "mix"; result: Pick<MixResult, "verdict" | "activeClasses">; verdictLabel: string; productNames: [string, string] }
  | { kind: "day3"; streak: number }
  | { kind: "day7"; streak: number; earned: number }
  | { kind: "friend"; pairStreak: number; myName: string | null; friendName: string | null; inviteToken: string | null };

export interface ShareOptions {
  format?: ShareFormat;
  showNames?: boolean;
}

/** Which kinds offer the names toggle at all. */
export function canShowNames(kind: ShareKind) {
  return kind === "rota" || kind === "mix" || kind === "friend";
}

const classesLine = (classes: ActiveClass[]) => (classes.length ? classes.map((c) => ACTIVE_CLASS_LABEL[c]).join(" + ") : "Not confirmed");

export function buildShareCard(input: ShareInput, options: ShareOptions = {}): ShareCardPayload {
  const format = options.format ?? "story";
  const showNames = !!options.showNames && canShowNames(input.kind);
  const base = { format, namesShown: showNames, activeClasses: null, verdict: null, productNames: [] as string[] };
  switch (input.kind) {
    case "rota":
      return {
        ...base,
        kind: "rota",
        headline: "My week, planned.",
        subline: showNames
          ? input.productNames.join(" · ")
          : `${input.treatmentDays} treatment ${input.treatmentDays === 1 ? "day" : "days"} · ${input.recoveryDays} recovery`,
        productNames: showNames ? input.productNames : [],
        deepLink: "/?from=share-rota",
      };
    case "mix": {
      const [a, b] = input.result.activeClasses;
      return {
        ...base,
        kind: "mix",
        headline: input.verdictLabel,
        subline: showNames ? input.productNames.join(" + ") : `${classesLine(a)} · ${classesLine(b)}`,
        productNames: showNames ? [...input.productNames] : [],
        activeClasses: [a, b],
        verdict: input.result.verdict,
        deepLink: "/mix?from=share",
      };
    }
    case "day3":
      return { ...base, kind: "day3", headline: "Day 3.", subline: `${input.streak}-day skin streak`, deepLink: "/?from=share-day3" };
    case "day7":
      return { ...base, kind: "day7", headline: "Rota complete.", subline: `${input.earned} of 7 days · ${input.streak}-day skin streak`, deepLink: "/?from=share-day7" };
    case "friend":
      return {
        ...base,
        kind: "friend",
        headline: `Friend Streak ${input.pairStreak}`,
        subline: showNames && input.myName && input.friendName ? `${input.myName} and ${input.friendName}` : "Me and a friend",
        deepLink: input.inviteToken ? `/i/${encodeURIComponent(input.inviteToken)}` : "/?from=share-friend",
      };
  }
}

/** WhatsApp share URL: opens the chooser with prefilled text. We never hold contact data. */
export function whatsappShareUrl(text: string) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
