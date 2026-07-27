CREATE TABLE IF NOT EXISTS pricing_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  price_cents INTEGER,
  is_closed INTEGER NOT NULL DEFAULT 0 CHECK(is_closed IN (0,1)),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK(end_date > start_date),
  CHECK(price_cents IS NULL OR price_cents >= 0)
);
CREATE INDEX IF NOT EXISTS idx_pricing_rules_dates ON pricing_rules(start_date, end_date);
ALTER TABLE bookings ADD COLUMN terms_version TEXT NOT NULL DEFAULT 'M306-2026-07-27-v1.1';
