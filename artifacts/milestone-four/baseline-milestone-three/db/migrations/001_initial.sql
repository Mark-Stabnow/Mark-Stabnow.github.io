CREATE TABLE users (
  id UUID PRIMARY KEY,
  username TEXT NOT NULL UNIQUE CHECK (username = lower(username)),
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('manager', 'clerk', 'viewer')),
  failed_count INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX sessions_expiry_idx ON sessions(expires_at);
CREATE TABLE categories (id UUID PRIMARY KEY, name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 80));
CREATE UNIQUE INDEX categories_name_idx ON categories(lower(name));
CREATE TABLE locations (id UUID PRIMARY KEY, name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 80));
CREATE UNIQUE INDEX locations_name_idx ON locations(lower(name));
CREATE TABLE items (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  sku TEXT NOT NULL UNIQUE CHECK (sku ~ '^[A-Z0-9][A-Z0-9._-]{0,63}$'),
  category_id UUID NOT NULL REFERENCES categories(id),
  location_id UUID NOT NULL REFERENCES locations(id),
  on_hand INTEGER NOT NULL CHECK (on_hand BETWEEN 0 AND 1000000000),
  reorder_level INTEGER NOT NULL CHECK (reorder_level BETWEEN 0 AND 1000000000),
  notes TEXT NOT NULL DEFAULT '' CHECK (length(notes) <= 1000),
  version INTEGER NOT NULL DEFAULT 1,
  archived BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX items_active_page_idx ON items(id) WHERE NOT archived;
CREATE TABLE stock_transactions (
  id UUID PRIMARY KEY,
  item_id UUID NOT NULL REFERENCES items(id),
  user_id UUID NOT NULL REFERENCES users(id),
  operation_id UUID NOT NULL,
  delta INTEGER NOT NULL,
  balance_after INTEGER NOT NULL CHECK (balance_after BETWEEN 0 AND 1000000000),
  reason TEXT NOT NULL CHECK (length(reason) BETWEEN 1 AND 200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(user_id, operation_id)
);
CREATE INDEX stock_history_idx ON stock_transactions(item_id, created_at DESC, id);
CREATE TABLE audit_log (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  item_id UUID NOT NULL REFERENCES items(id),
  action TEXT NOT NULL,
  detail JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
