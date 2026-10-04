-- Milestone Four. Do not edit 001_initial.sql: its applied checksum is retained.
ALTER TABLE items ADD CONSTRAINT items_version_positive CHECK (version >= 1);
ALTER TABLE users ADD CONSTRAINT users_failed_count_nonnegative CHECK (failed_count >= 0);

-- Foreign keys do not themselves create indexes on these referencing columns.
CREATE INDEX items_category_idx ON items(category_id);
CREATE INDEX items_location_idx ON items(location_id);
CREATE INDEX items_low_stock_idx ON items(on_hand, id)
  WHERE NOT archived AND on_hand > 0 AND on_hand <= reorder_level;
CREATE INDEX audit_item_history_idx ON audit_log(item_id, created_at DESC, id);

-- One batch represents one original, canonical inventory export. Mapping choices
-- are explicit because the original Android schema has no category or reorder level.
CREATE TABLE import_batches (
  id UUID PRIMARY KEY,
  source_sha256 TEXT NOT NULL UNIQUE CHECK (source_sha256 ~ '^[a-f0-9]{64}$'),
  source_label TEXT NOT NULL CHECK (length(source_label) BETWEEN 1 AND 255),
  category TEXT NOT NULL CHECK (length(category) BETWEEN 1 AND 80),
  reorder_level INTEGER NOT NULL CHECK (reorder_level BETWEEN 0 AND 1000000000),
  item_count INTEGER NOT NULL CHECK (item_count BETWEEN 1 AND 1000),
  imported_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE import_rows (
  batch_id UUID NOT NULL REFERENCES import_batches(id),
  source_id BIGINT NOT NULL CHECK (source_id > 0),
  item_id UUID NOT NULL UNIQUE REFERENCES items(id),
  source_updated_at TEXT NOT NULL,
  source_record JSONB NOT NULL CHECK (jsonb_typeof(source_record) = 'object'),
  PRIMARY KEY(batch_id, source_id)
);

-- A report, not a repair. Include archived items and zero-quantity opening counts.
-- A missing ledger is a discrepancy even when the displayed balance is zero.
CREATE VIEW inventory_reconciliation AS
SELECT i.id AS item_id, i.sku, i.archived, i.on_hand,
       count(t.id) AS transaction_count,
       coalesce(sum(t.delta::bigint), 0) AS ledger_balance,
       count(t.id) > 0 AND coalesce(sum(t.delta::bigint), 0) = i.on_hand AS balanced
FROM items i LEFT JOIN stock_transactions t ON t.item_id = i.id
GROUP BY i.id, i.sku, i.archived, i.on_hand;
