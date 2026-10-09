import { bindings } from "./cloudflare-env";
import { getCatalogueRecord } from "./catalogue-store";

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

  // Never persist a client assertion as a verified canonical identity. "verified"
  // (matched to library) can only be granted by a server source, never the client.
  if (identityStatus === "verified" || inciStatus === "verified") {
    throw new Error("validation:verified_requires_server_provenance");
  }

  // Catalogue linkage is re-resolved server-side. A client-supplied catalogueId
  // that does not exist is rejected; the stable identity key (real barcode) is
  // taken from OUR record, never from the client. Membership is source_listed,
  // so identity is at most user_confirmed here — never verified.
  const catalogueId = typeof draft.catalogueId === "string" ? draft.catalogueId.slice(0, 160) : null;
  let identityKey: string | null = null;
  if (catalogueId) {
    const record = getCatalogueRecord(catalogueId);
    if (!record) throw new Error("validation:catalogue_not_found");
    identityKey = record.product.identityKey;
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
      catalogueId,
    },
  });

  const db = (await bindings()).DB;
  try {
    await db.prepare(
      `INSERT INTO shelf_items
        (id, owner_user_id, identity_key, brand, product_name, product_type, product_format,
         identity_confidence, ingredient_confidence, inci_json, evidence_json, source,
         finished_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`
    ).bind(
      id, ownerUserId, identityKey, brand, name, category, format, identityStatus, inciStatus,
      serializedIngredients, evidence, source, now, now
    ).run();
  } catch (err) {
    // Same canonical identity (barcode) already on this owner's shelf: return the
    // existing item instead of a duplicate row. NULL identity_key never collides.
    if (identityKey) {
      const existing = await db.prepare("SELECT * FROM shelf_items WHERE owner_user_id = ? AND identity_key = ?")
        .bind(ownerUserId, identityKey).first<ShelfRow>();
      if (existing) return { product: shelfRowToProduct(existing), duplicate: true };
    }
    throw err;
  }

  const row = await db.prepare("SELECT * FROM shelf_items WHERE id = ? AND owner_user_id = ?")
    .bind(id, ownerUserId).first<ShelfRow>();
  if (!row) throw new Error("insert_failed");
  return { product: shelfRowToProduct(row), duplicate: false };
}


/** Ownership enforced in the SQL predicate, including updates and deletes. */
export async function updateShelfProduct(ownerUserId: string, id: string, input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("validation:patch");
  const patch = input as Record<string, unknown>;
  const db = (await bindings()).DB;
  const previous = await db.prepare("SELECT * FROM shelf_items WHERE id = ? AND owner_user_id = ?")
    .bind(id, ownerUserId).first<ShelfRow>();
  if (!previous) return null;

  const brand = patch.brand === undefined ? previous.brand : str(patch.brand, 120);
  const name = patch.name === undefined ? previous.product_name : str(patch.name, 180, true);
  const category = patch.category === undefined ? previous.product_type : str(patch.category, 40, true);
  const format = patch.format === undefined ? previous.product_format : str(patch.format, 40, true);
  if (!CATEGORY.has(category) || !FORMAT.has(format)) throw new Error("validation:enum");

  if (patch.finished !== undefined && typeof patch.finished !== "boolean") throw new Error("validation:finished");
  const finishedAt = patch.finished === undefined
    ? previous.finished_at
    : patch.finished ? new Date().toISOString() : null;
  const evidence = safeObject(previous.evidence_json);
  if (patch.placement !== undefined) {
    if (!["am", "pm", "none"].includes(String(patch.placement))) throw new Error("validation:placement");
    evidence.placement = patch.placement;
  }

  const ingredients = safeArray(previous.inci_json);
  let inciStatus = previous.ingredient_confidence;
  if (patch.ingredientCorrections !== undefined) {
    if (!Array.isArray(patch.ingredientCorrections) || patch.ingredientCorrections.length > 200) throw new Error("validation:corrections");
    const corrected = patch.ingredientCorrections as unknown[];
    for (const item of corrected) {
      if (!item || typeof item !== "object") throw new Error("validation:correction");
      const change = item as Record<string, unknown>;
      const ingredientId = str(change.ingredientId, 120, true);
      if (change.text !== null && (typeof change.text !== "string" || change.text.length > 200)) throw new Error("validation:correction_text");
      const index = ingredients.findIndex((v) => typeof v === "object" && v !== null && (v as Record<string, unknown>).id === ingredientId);
      if (index < 0) throw new Error("validation:ingredient_not_found");
      if (change.text === null) ingredients.splice(index, 1);
      else ingredients[index] = { id: ingredientId, text: (change.text as string).trim(), status: "corrected", activeClass: null, normalized: null, flagged: false };
    }
    inciStatus = ingredients.length ? "corrected" : "unknown";
  }
  if (JSON.stringify(ingredients).length > 64_000) throw new Error("validation:ingredients");
  const identityStatus = (brand !== previous.brand || name !== previous.product_name)
    ? "corrected" : previous.identity_confidence;
  const now = new Date().toISOString();
  await db.prepare(
    `UPDATE shelf_items SET brand = ?, product_name = ?, product_type = ?, product_format = ?,
     identity_confidence = ?, ingredient_confidence = ?, inci_json = ?, evidence_json = ?,
     finished_at = ?, updated_at = ? WHERE id = ? AND owner_user_id = ?`
  ).bind(
    brand, name, category, format, identityStatus, inciStatus, JSON.stringify(ingredients),
    JSON.stringify(evidence), finishedAt, now, id, ownerUserId
  ).run();
  const updated = await db.prepare("SELECT * FROM shelf_items WHERE id = ? AND owner_user_id = ?")
    .bind(id, ownerUserId).first<ShelfRow>();
  return updated ? shelfRowToProduct(updated) : null;
}

export async function deleteShelfProduct(ownerUserId: string, id: string) {
  const db = (await bindings()).DB;
  const result = await db.prepare("DELETE FROM shelf_items WHERE id = ? AND owner_user_id = ?")
    .bind(id, ownerUserId).run();
  return (result.meta?.changes ?? 0) > 0;
}
