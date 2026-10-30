import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * Gate 1 domain persistence only. Better Auth owns its own generated auth schema.
 * Strings are ISO timestamps/dates and UUID/opaque IDs; no client-supplied owner IDs.
 * These tables may ONLY be queried through authenticated server routes.
 */
export const shelfItems = sqliteTable(
  "shelf_items",
  {
    id: text("id").primaryKey(),
    ownerUserId: text("owner_user_id").notNull(),
    identityKey: text("identity_key"), // stable verified SKU, or user-confirmed key; null if unknown
    brand: text("brand").notNull(),
    productName: text("product_name").notNull(),
    productType: text("product_type").notNull(),
    productFormat: text("product_format").notNull().default("unknown"),
    identityConfidence: text("identity_confidence").notNull().default("unknown"),
    ingredientConfidence: text("ingredient_confidence").notNull().default("unknown"),
    inciJson: text("inci_json").notNull().default("[]"),
    evidenceJson: text("evidence_json").notNull().default("[]"),
    source: text("source").notNull().default("manual"),
    finishedAt: text("finished_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    index("shelf_owner_idx").on(t.ownerUserId),
    uniqueIndex("shelf_owner_identity_unique").on(t.ownerUserId, t.identityKey),
  ],
);

export const accountMergeJobs = sqliteTable(
  "account_merge_jobs",
  {
    id: text("id").primaryKey(), // idempotency key, server-generated
    guestUserId: text("guest_user_id").notNull(),
    targetUserId: text("target_user_id").notNull(),
    status: text("status").notNull().default("pending"), // pending | committed | failed
    progressJson: text("progress_json").notNull().default("{}"),
    createdAt: text("created_at").notNull(),
    completedAt: text("completed_at"),
  },
  (t) => [
    index("merge_guest_idx").on(t.guestUserId),
    index("merge_target_idx").on(t.targetUserId),
  ],
);

/** Real product pilot: immutable plan snapshot, editable only for archive/rescue reflection. */
export const rotaSnapshots = sqliteTable("rota_snapshots", {
  id: text("id").primaryKey(),
  ownerUserId: text("owner_user_id").notNull(),
  createKey: text("create_key").notNull(),
  snapshotJson: text("snapshot_json").notNull(),
  timeZone: text("timezone").notNull(),
  startDate: text("start_date").notNull(),
  archivedAt: text("archived_at"),
  createdAt: text("created_at").notNull(),
}, (t) => [
  index("rota_owner_idx").on(t.ownerUserId, t.createdAt),
  uniqueIndex("rota_owner_create_key").on(t.ownerUserId, t.createKey),
]);

/** 04:00 user-local dated record; optimistic revision prevents lost updates. */
export const dayRecords = sqliteTable("day_records", {
  ownerUserId: text("owner_user_id").notNull(),
  rotaId: text("rota_id").notNull(),
  skincareDate: text("skincare_date").notNull(),
  recordJson: text("record_json").notNull(),
  revision: integer("revision").notNull().default(0),
  updatedAt: text("updated_at").notNull(),
}, (t) => [
  primaryKey({ columns: [t.ownerUserId, t.rotaId, t.skincareDate] }),
  index("day_owner_idx").on(t.ownerUserId, t.rotaId),
]);
