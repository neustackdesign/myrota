import { getProducts } from "./catalogue";
import type {
  ActiveClass,
  Product,
  Rota,
  RotaDay,
  RoutineContext,
  RoutineStep,
  ShelfObservation,
} from "./types";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const AM_TREATMENT_ORDER: ActiveClass[] = [
  "vitamin_c_laa",
  "niacinamide",
  "azelaic_acid",
];

function toStep(product: Product, note?: string): RoutineStep {
  return {
    productId: product.id,
    productName: product.name,
    brand: product.brand,
    note,
  };
}

function firstKind(products: Product[], kind: Product["kind"]) {
  return products.find((product) => product.kind === kind);
}

function firstClass(products: Product[], activeClass: ActiveClass) {
  return products.find((product) => product.activeClasses.includes(activeClass));
}

function duplicates(products: Product[]) {
  const byClass = new Map<ActiveClass, Product[]>();

  for (const product of products) {
    for (const activeClass of product.activeClasses) {
      if (["hydrator", "sunscreen"].includes(activeClass)) continue;
      const list = byClass.get(activeClass) ?? [];
      list.push(product);
      byClass.set(activeClass, list);
    }
  }

  return [...byClass.entries()].filter(([, items]) => items.length > 1);
}

export function buildShelfObservations(products: Product[]): ShelfObservation[] {
  const observations: ShelfObservation[] = [];

  if (!products.some((product) => product.kind === "sunscreen")) {
    observations.push({
      id: "missing-spf",
      title: "No sunscreen detected",
      detail: "Your morning rota has no sunscreen step yet.",
    });
  }

  for (const [activeClass, items] of duplicates(products)) {
    observations.push({
      id: `duplicate-${activeClass}`,
      title: `${items.length} products doing a similar job`,
      detail: `We found multiple ${activeClass.replaceAll("_", " ")} products. The rota schedules one rather than stacking them.`,
    });
  }

  const strong = products.filter((product) =>
    product.activeClasses.some((activeClass) =>
      ["retinoid", "aha", "bha"].includes(activeClass),
    ),
  );

  if (strong.length >= 2) {
    observations.push({
      id: "separated-treatments",
      title: "Strong treatments are separated",
      detail: "The rota spreads your retinoid and exfoliating steps across different nights.",
    });
  }

  return observations.slice(0, 3);
}

function scheduledStrongTreatment(
  products: Product[],
  dayIndex: number,
  context: RoutineContext,
): Product | undefined {
  const retinoid = firstClass(products, "retinoid");
  const aha = firstClass(products, "aha");
  const bha = firstClass(products, "bha");
  const exfoliant = aha ?? bha;

  const retinoidNights =
    context.retinoidExperience === "regular" ? [0, 2, 4] : [0, 3];

  if (retinoid && retinoidNights.includes(dayIndex)) return retinoid;

  const exfoliantNights = retinoid ? [1, 5] : [1, 4];
  if (exfoliant && exfoliantNights.includes(dayIndex)) return exfoliant;

  return undefined;
}

function buildMorning(products: Product[]): RoutineStep[] {
  const steps: RoutineStep[] = [];
  const cleanser = firstKind(products, "cleanser");
  const moisturiser = firstKind(products, "moisturiser");
  const sunscreen = firstKind(products, "sunscreen");

  if (cleanser) steps.push(toStep(cleanser));

  const morningTreatment = AM_TREATMENT_ORDER
    .map((activeClass) => firstClass(products, activeClass))
    .find(Boolean);

  if (morningTreatment) steps.push(toStep(morningTreatment));

  if (moisturiser) steps.push(toStep(moisturiser));
  if (sunscreen) steps.push(toStep(sunscreen, "Final morning step"));

  return steps;
}

function buildEvening(
  products: Product[],
  dayIndex: number,
  context: RoutineContext,
): { steps: RoutineStep[]; theme: string } {
  const steps: RoutineStep[] = [];
  const cleanser = firstKind(products, "cleanser");
  const moisturiser = firstKind(products, "moisturiser");
  const treatment = scheduledStrongTreatment(products, dayIndex, context);

  if (cleanser) steps.push(toStep(cleanser));

  if (treatment) {
    steps.push(toStep(treatment));
  }

  if (moisturiser) steps.push(toStep(moisturiser));

  return {
    steps,
    theme: treatment
      ? treatment.activeClasses.includes("retinoid")
        ? "Retinoid night"
        : "Exfoliation night"
      : "Recovery night",
  };
}

export function generateRota(
  productIds: string[],
  context: RoutineContext = {},
): Rota {
  const products = getProducts(productIds);
  const start = new Date();
  const startDate = [
    start.getFullYear(),
    String(start.getMonth() + 1).padStart(2, "0"),
    String(start.getDate()).padStart(2, "0"),
  ].join("-");

  const days: RotaDay[] = DAY_LABELS.map((label, index) => {
    const evening = buildEvening(products, index, context);

    return {
      index,
      label,
      am: { label: "AM", steps: buildMorning(products) },
      pm: { label: "PM", steps: evening.steps, theme: evening.theme },
    };
  });

  return {
    id: `rota-${Date.now()}`,
    createdAt: new Date().toISOString(),
    startDate,
    productIds,
    days,
    observations: buildShelfObservations(products),
    explanation:
      "We kept your morning basics consistent, separated stronger treatment nights, and left recovery space in the week.",
  };
}
