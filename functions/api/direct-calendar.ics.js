function icalEscape(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/\r?\n/g, '\\n');
}

function dateCompact(iso) {
  return String(iso || '').replaceAll('-', '');
}

function utcStamp(value) {
  const date = value ? new Date(value) : new Date();
  const valid = Number.isNaN(date.getTime()) ? new Date() : date;
  return valid.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function eventLines({ uid, start, end, stamp, summary }) {
  return [
    'BEGIN:VEVENT',
    `UID:${icalEscape(uid)}@marconi306.it`,
    `DTSTAMP:${utcStamp(stamp)}`,
    `DTSTART;VALUE=DATE:${dateCompact(start)}`,
    `DTEND;VALUE=DATE:${dateCompact(end)}`,
    `SUMMARY:${icalEscape(summary)}`,
    'TRANSP:OPAQUE',
    'END:VEVENT'
  ].join('\r\n');
}

export async function onRequestGet({ env }) {
  if (!env.DB) {
    return new Response('Database non configurato', { status: 503 });
  }

  const [bookingQuery, closureQuery] = await Promise.all([
    env.DB.prepare(`
      SELECT id, start_date, end_date, confirmed_at, created_at
      FROM bookings
      WHERE status = 'CONFIRMED'
      ORDER BY start_date
    `).all(),
    env.DB.prepare(`
      SELECT id, start_date, end_date, updated_at, created_at, note
      FROM pricing_rules
      WHERE is_closed = 1
      ORDER BY start_date
    `).all()
  ]);

  const events = [];
  const seenClosures = new Set();

  for (const row of bookingQuery.results || []) {
    events.push(eventLines({
      uid: `booking-${row.id}`,
      start: row.start_date,
      end: row.end_date,
      stamp: row.confirmed_at || row.created_at,
      summary: 'Prenotazione diretta Marconi306'
    }));
  }

  // Il gestionale può aver creato righe duplicate dello stesso periodo:
  // nel feed ne esportiamo comunque una sola.
  for (const row of closureQuery.results || []) {
    const key = `${row.start_date}|${row.end_date}`;
    if (seenClosures.has(key)) continue;
    seenClosures.add(key);

    events.push(eventLines({
      uid: `closure-${row.start_date}-${row.end_date}`,
      start: row.start_date,
      end: row.end_date,
      stamp: row.updated_at || row.created_at,
      summary: row.note || 'Periodo non disponibile Marconi306'
    }));
  }

  const body = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Marconi306//Prenotazioni dirette e chiusure//IT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Marconi306 - Disponibilità diretta',
    ...events,
    'END:VCALENDAR',
    ''
  ].join('\r\n');

  return new Response(body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="marconi306-direct-calendar.ics"',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache'
    }
  });
}
