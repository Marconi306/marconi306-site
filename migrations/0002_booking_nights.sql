CREATE TABLE IF NOT EXISTS booking_nights (
  stay_date TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_booking_nights_booking ON booking_nights(booking_id);
