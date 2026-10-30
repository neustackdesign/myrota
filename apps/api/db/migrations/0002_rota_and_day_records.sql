-- Myrota v1 real product pilot: rota snapshots and append-only completion evidence.
-- Private per-user tables; never accessed without a validated Better Auth session.
CREATE TABLE IF NOT EXISTS rota_snapshots (
  id TEXT PRIMARY KEY NOT NULL,
  owner_user_id TEXT NOT NULL,
  create_key TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  timezone TEXT NOT NULL,
  start_date TEXT NOT NULL,
  archived_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS rota_owner_idx ON rota_snapshots(owner_user_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS rota_one_active_owner ON rota_snapshots(owner_user_id) WHERE archived_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS rota_owner_create_key ON rota_snapshots(owner_user_id, create_key);
CREATE TABLE IF NOT EXISTS day_records (
  owner_user_id TEXT NOT NULL,
  rota_id TEXT NOT NULL,
  skincare_date TEXT NOT NULL,
  record_json TEXT NOT NULL,
  revision INTEGER DEFAULT 0 NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (owner_user_id, rota_id, skincare_date)
);
CREATE INDEX IF NOT EXISTS day_owner_idx ON day_records(owner_user_id, rota_id);
