export function addDays(iso, amount = 1) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

export function nightsBetween(start, end) {
  return Math.round((new Date(`${end}T00:00:00Z`) - new Date(`${start}T00:00:00Z`)) / 86400000);
}

export function eachNight(start, end) {
  const nights = [];
  for (let day = start; day < end; day = addDays(day)) nights.push(day);
  return nights;
}

export function nightlyPrice(iso) {
  const [year, month, day] = iso.split('-').map(Number);
  if (year === 2026) {
    if (month === 7) return 85;
    if (month === 8) return day >= 10 && day <= 16 ? 120 : 100;
    if (month === 9) return 85;
    if (month === 10) return 80;
    if (month === 11) return 70;
    if (month === 12) return [24, 25, 26, 30, 31].includes(day) ? 80 : 70;
  }
  if (year === 2027 && month === 1) return day === 1 ? 80 : 70;
  return null;
}

export function calculateStay(start, end, guests = 2) {
  const nights = nightsBetween(start, end);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || nights < 1 || nights > 30) {
    throw new Error('Date del soggiorno non valide.');
  }
  const prices = eachNight(start, end).map(nightlyPrice);
  if (!prices.every(Number.isFinite)) throw new Error('Tariffa non disponibile per le date selezionate.');
  if (![1, 2].includes(Number(guests))) throw new Error('Numero di ospiti non valido.');
  const base = prices.reduce((sum, price) => sum + price, 0);
  const discount = Number(guests) === 1 ? Math.round(base * 0.10 * 100) / 100 : 0;
  return { nights, base, discount, total: base - discount };
}

export async function cleanExpiredHolds(db) {
  await db.prepare("DELETE FROM bookings WHERE status = 'HOLD' AND hold_expires_at <= datetime('now')").run();
}

export async function hasConflict(db, start, end, excludeId = '') {
  const row = await db.prepare(`
    SELECT id FROM bookings
    WHERE id <> ?1
      AND (status = 'CONFIRMED' OR (status = 'HOLD' AND hold_expires_at > datetime('now')))
      AND start_date < ?3 AND end_date > ?2
    LIMIT 1
  `).bind(excludeId, start, end).first();
  return Boolean(row);
}

export function validateGuest(data) {
  const guest = {
    firstName: String(data.firstName || '').trim().slice(0, 80),
    lastName: String(data.lastName || '').trim().slice(0, 80),
    email: String(data.email || '').trim().toLowerCase().slice(0, 160),
    phone: String(data.phone || '').trim().slice(0, 40),
    guests: Number(data.guests),
    notes: String(data.notes || '').trim().slice(0, 1000)
  };
  if (!guest.firstName || !guest.lastName) throw new Error('Inserisci nome e cognome.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guest.email)) throw new Error('Inserisci un indirizzo email valido.');
  if (!guest.phone) throw new Error('Inserisci un numero di telefono.');
  if (![1, 2].includes(guest.guests)) throw new Error('Numero di ospiti non valido.');
  return guest;
}

export function randomId(prefix = 'M306') {
  return `${prefix}-${crypto.randomUUID()}`;
}


function unfoldIcal(text) {
  return String(text || '').replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/);
}

function icalDateOnly(value) {
  const match = String(value || '').match(/(\d{4})(\d{2})(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

function parseIcalRanges(text) {
  const ranges = [];
  let event = null;
  for (const line of unfoldIcal(text)) {
    if (line === 'BEGIN:VEVENT') { event = {}; continue; }
    if (line === 'END:VEVENT') {
      if (event?.start) {
        const end = event.end || addDays(event.start, 1);
        if (end > event.start) ranges.push({ start: event.start, end });
      }
      event = null;
      continue;
    }
    if (!event) continue;
    const separator = line.indexOf(':');
    if (separator < 0) continue;
    const key = line.slice(0, separator).toUpperCase();
    const value = line.slice(separator + 1);
    if (key.startsWith('DTSTART')) event.start = icalDateOnly(value);
    if (key.startsWith('DTEND')) event.end = icalDateOnly(value);
  }
  return ranges;
}

async function fetchIcalRanges(url, label) {
  if (!url) throw new Error(`${label} non configurato.`);
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Marconi306-Booking/1.0' },
    cf: { cacheTtl: 60, cacheEverything: true }
  });
  if (!response.ok) throw new Error(`${label} non raggiungibile.`);
  return parseIcalRanges(await response.text());
}

export async function hasExternalConflict(env, start, end) {
  const [booking, airbnb] = await Promise.all([
    fetchIcalRanges(env.BOOKING_ICAL_URL, 'Calendario Booking'),
    fetchIcalRanges(env.AIRBNB_ICAL_URL, 'Calendario Airbnb')
  ]);
  return [...booking, ...airbnb].some(range => range.start < end && range.end > start);
}
