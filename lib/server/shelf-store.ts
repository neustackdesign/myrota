import { bindings } from "./cloudflare-env";

const EVIDENCE = new Set(["verified", "user_confirmed", "partial", "unknown", "corrected"]);
const CATEGORY = new Set(["cleanser", "toner", "serum", "treatment", "moisturiser", "sunscreen", "other"]);
const FORMAT = new Set(["rinse_off", "leave_on", "unknown"]);
const SOURCE = new Set(["scan", "gallery", "paste", "search", "manual"]);

type Json = Record<string, unknown>;

interface ShelfRow {
  id: string;
  owner_user_id: string;
  identity_key: string | null;
  brand: string;
  product_name: string;
  product_type: string;
  product_format: string;
  identity_confidence: string;
  ingredient_confidence: string;
  inci_json: string;
  evidence_json: string;
  source: string;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

function safeObject(json: string): Json {
  try {
    const value = JSON.parse(json);
    return value && typeof value === "object" && !Array.isArray(value) ? value as Json : {};
  } catch {
    return {};
  }
}
function safeArray(json: string): unknown[] {
  try {
    const value = JSON.parse(json);
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}
export function shelfRowToProduct(row: ShelfRow) {
  const evidence = safeObject(row.evidence_json);
  return {
    id: row.id,
    brand: row.brand,
    name: row.product_name,
    category: row.product_type,
    format: row.product_format,
    identityStatus: row.identity_confidence,
    inciStatus: row.ingredient_confidence,
    identityKey: row.identity_key,
    variant: typeof evidence.variant === "string" ? evidence.variant : null,
    ingredients: safeArray(row.inci_json),
    flags: Array.isArray(evidence.flags) ? evidence.flags : [],
    placement: typeof evidence.placement === "string" ? evidence.placement : undefined,
    source: row.source,
    finishedAt: row.finished_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listShelf(ownerUserId: string) {
  const db = (await bindings()).DB;
  const result = await db.prepare(
    "SELECT * FROM shelf_items WHERE owner_user_id = ? ORDER BY created_at ASC"
  ).bind(ownerUserId).all<ShelfRow>();
  return result.results.map(shelfRowToProduct);
}

function str(value: unknown, max: number, required = false) {
  if (value == null && !required) return "";
  if (typeof value !== "string") throw new Error("validation:string");
  const v = value.trim();
  if (required && !v) throw new Error("validation:required");
  if (v.length > max) throw new Error("validation:length");
  return v;
}

export async function addShelfProduct(ownerUserId: string, input: unknown) {
  const draft = (input as { draft?: Json } | null)?.draft;
  if (!draft || typeof draft !== "object") throw new Error("validation:draft");

  const brand = str(draft.brand, 120);
  const name = str(draft.name, 180, true);
  const category = str(draft.category, 40, true);
  const format = str(draft.format, 40, true);
  const identityStatus = str(draft.identityStatus, 40, true);
  const inciStatus = str(draft.inciStatus, 40, true);
  const source = str(draft.source, 40, true);
  if (!CATEGORY.has(category) || !FORMAT.has(format) || !EVIDENCE.has(identityStatus) ||
      !EVIDENCE.has(inciStatus) || !SOURCE.has(source)) {
    throw new Error("validation:enum");
  }

  // Gate 1 cannot re-verify client-provided catalogue/extraction IDs yet.
  // Never persist a client assertion as a verified canonical identity.
  if (identityStatus === "verified" || inciStatus === "verified") {
    throw new Error("validation:verified_requires_server_provenance");
  }

  const ingredients = Array.isArray(draft.ingredients) ? draft.ingredients : [];
  if (ingredients.length > 200) throw new Error("validation:ingredients");
  const serializedIngredients = JSON.stringify(ingredients);
  if (serializedIngredients.length > 64_000) throw new Error("validation:ingredients");

  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const evidence = JSON.stringify({
    variant: typeof draft.variant === "string" ? draft.variant.slice(0, 120) : null,
    placement: typeof draft.placement === "string" ? draft.placement : null,
    flags: [],
    provenance: {
      extractionId: typeof draft.extractionId === "string" ? draft.extractionId.slice(0, 160) : null,
      catalogueId: typeof draft.catalogueId === "string" ? draft.catalogueId.slice(0, 160) : null,
    },
  });

  const db = (await bindings()).DB;
  await db.prepare(
    `INSERT INTO shelf_items
      (id, owner_user_id, identity_key, brand, product_name, product_type, product_format,
       identity_confidence, ingredient_confidence, inci_json, evidence_json, source,
       finished_at, created_at, updated_at)
     VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`
  ).bind(
    id, ownerUserId, brand, name, category, format, identityStatus, inciStatus,
    serializedIngredients, evidence, source, now, now
  ).run();

  const row = await db.prepare("SELECT * FROM shelf_items WHERE id = ? AND owner_user_id = ?")
    .bind(id, ownerUserId).first<ShelfRow>();
  if (!row) throw new Error("insert_failed");
  return shelfRowToProduct(row);
}
