CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  paypal_order_id TEXT UNIQUE,
  paypal_capture_id TEXT,
  status TEXT NOT NULL CHECK(status IN ('HOLD','CONFIRMED','CANCELLED')),
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  nights INTEGER NOT NULL,
  guests INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  notes TEXT,
  hold_expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  confirmed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_bookings_dates ON bookings(start_date, end_date, status);
CREATE INDEX IF NOT EXISTS idx_bookings_hold_expiry ON bookings(status, hold_expires_at);
