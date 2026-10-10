-- Additive: per-day usage counters for /api/extract abuse + cost protection.
-- No existing table touched. Keyed by (bucket, day); bucket is global / ip:<ip> / user:<id>.
CREATE TABLE IF NOT EXISTS extract_usage (
  bucket TEXT NOT NULL,
  day TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, day)
);
