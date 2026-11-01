/**
 * Single, code-reviewed source of truth for myrota's PUBLIC promotional copy.
 * Safe to edit without touching health-rule copy, account logic, or user data.
 * Landing imagery is intentionally resolved through the licensed asset manifest.
 *
 * To change text: edit this file, open PR, inspect Vercel Preview, merge.
 * No CMS, database calls, third-party tokens, or content fetching needed.
 */
export const PUBLIC_MARKETING = {
  seo: {
    title: "myrota — Your shelf, in the right order.",
    titleTemplate: "%s · myrota",
    description:
      "Add what's already in your bathroom. myrota plans the week — which nights for the strong stuff, which nights to rest — and tells you what goes on tonight.",
    applicationName: "myrota",
  },
  landing: {
    heroAsset: "landingHero",
    heading: "A seven-day rota from what's already on your shelf.",
    description:
      "Add the products you own. We'll map what we can confirm into a seven-day plan, and tell you plainly what still needs checking.",
    primaryCta: "Add my products",
    secondaryCta: "Or check two products together",
    valueLine: "No account. No download. About a minute.",
    returningCta: "Continue my rota →",
    labelDisclaimer:
      "myrota reads what labels declare. It doesn't diagnose, and no warning doesn't mean a product is safe or authentic.",
  },
  // Editorial variants for artwork and approved acquisition placements.
  // Each surface remains draft until reviewed. These do NOT publish automatically.
  campaign: {
    whatsappInvite: {
      status: "draft",
      headline: "Your shelf has a rota. What's on theirs?",
      action: "Build your own seven-day rota",
    },
    organicSocial: {
      status: "draft",
      headline: "Less shelf chaos. More follow-through.",
      action: "Start with what you already own",
    },
  },
} as const;

export type CampaignSurface = keyof typeof PUBLIC_MARKETING.campaign;
