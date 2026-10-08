/** Demo scenario ids and labels only (no fixture data), safe to import anywhere. */
export type DemoScenario =
  | "fresh"
  | "today-am"
  | "today-pm"
  | "late-night"
  | "missed"
  | "rescued"
  | "missed-last-week"
  | "second-miss"
  | "rest-day"
  | "week-complete"
  | "week-ended"
  | "friend-joined"
  | "flagged-shelf";

export const DEMO_SCENARIOS: { id: DemoScenario; label: string }[] = [
  { id: "fresh", label: "Fresh visitor · empty shelf" },
  { id: "today-am", label: "Today · morning, paired" },
  { id: "today-pm", label: "Today · evening atmosphere" },
  { id: "late-night", label: "Late night · before 04:00" },
  { id: "missed", label: "Yesterday missed · Rescue eligible" },
  { id: "rescued", label: "Rescued · continuity kept" },
  { id: "missed-last-week", label: "Day 7 missed · rescuable in week 2" },
  { id: "second-miss", label: "Second miss · Rescue used" },
  { id: "rest-day", label: "One-product invitee · Rest day" },
  { id: "week-complete", label: "Day 7 · 7/7 Rota complete" },
  { id: "week-ended", label: "Day 7 · Week ended 5/7" },
  { id: "friend-joined", label: "Inviter · Tobi joined" },
  { id: "flagged-shelf", label: "Shelf · safety flag + unknown" },
];
