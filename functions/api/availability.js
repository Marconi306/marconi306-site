function unfoldIcal(text) {
  return text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/);
}

function dateOnly(value) {
  const match = String(value || '').match(/(\d{4})(\d{2})(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

function addDays(iso, amount) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function parseEvents(text, source) {
  const lines = unfoldIcal(text);
  const ranges = [];
  let event = null;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      event = {};
      continue;
    }
    if (line === 'END:VEVENT') {
      if (event?.start) {
        const end = event.end || addDays(event.start, 1);
        if (end > event.start) ranges.push({ start: event.start, end, source });
      }
      event = null;
      continue;
    }
    if (!event) continue;

    const separator = line.indexOf(':');
    if (separator < 0) continue;
    const key = line.slice(0, separator).toUpperCase();
    const value = line.slice(separator + 1);
    if (key.startsWith('DTSTART')) event.start = dateOnly(value);
    if (key.startsWith('DTEND')) event.end = dateOnly(value);
  }
  return ranges;
}

function mergeRanges(ranges) {
  const sorted = ranges
    .filter(r => r.start && r.end && r.end > r.start)
    .sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
  const merged = [];
  for (const range of sorted) {
    const last = merged[merged.length - 1];
    if (!last || range.start > last.end) {
      merged.push({ start: range.start, end: range.end });
    } else if (range.end > last.end) {
      last.end = range.end;
    }
  }
  return merged;
}

async function fetchCalendar(url, source) {
  if (!url) throw new Error(`Variabile ${source} non configurata`);
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Marconi306-Availability/1.0' },
    cf: { cacheTtl: 60, cacheEverything: true }
  });
  if (!response.ok) throw new Error(`${source}: risposta ${response.status}`);
  return parseEvents(await response.text(), source);
}

export async function onRequestGet(context) {
  try {
    const [booking, airbnb] = await Promise.all([
      fetchCalendar(context.env.BOOKING_ICAL_URL, 'Booking'),
      fetchCalendar(context.env.AIRBNB_ICAL_URL, 'Airbnb')
    ]);
    let direct = [];
    if (context.env.DB) {
      await context.env.DB.prepare("DELETE FROM bookings WHERE status = 'HOLD' AND hold_expires_at <= datetime('now')").run();
      const { results = [] } = await context.env.DB.prepare("SELECT start_date AS start, end_date AS end FROM bookings WHERE status='CONFIRMED' OR (status='HOLD' AND hold_expires_at > datetime('now'))").all();
      direct = results;
    }
    const blockedRanges = mergeRanges([...booking, ...airbnb, ...direct]);
    return Response.json(
      { blockedRanges, updatedAt: new Date().toISOString() },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('Availability error', error);
    return Response.json(
      { error: 'Disponibilità temporaneamente non disponibile.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
