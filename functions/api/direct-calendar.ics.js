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
  const raw = String(value || '').trim();
  const parsed = raw ? new Date(raw.endsWith('Z') ? raw : `${raw.replace(' ', 'T')}Z`) : new Date();
  const safe = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  return safe.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function makeEvent({ uid, start, end, stamp, summary }) {
  return [
    'BEGIN:VEVENT',
    `UID:${icalEscape(uid)}@marconi306.it`,
    `DTSTAMP:${utcStamp(stamp)}`,
    `DTSTART;VALUE=DATE:${dateCompact(start)}`,
    `DTEND;VALUE=DATE:${dateCompact(end)}`,
    `SUMMARY:${icalEscape(summary)}`,
    'STATUS:CONFIRMED',
    'TRANSP:OPAQUE',
    'END:VEVENT'
  ].join('\r\n');
}

export async function onRequestGet({ env }) {
  if (!env.DB) {
    return new Response('Database non configurato', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }

  const [bookingsQuery, closuresQuery] = await Promise.all([
    env.DB.prepare(`
      SELECT id, start_date, end_date, confirmed_at, created_at
      FROM bookings
      WHERE status = 'CONFIRMED'
      ORDER BY start_date
    `).all(),
    env.DB.prepare(`
      SELECT MIN(id) AS id, start_date, end_date, MIN(created_at) AS created_at
      FROM pricing_rules
      WHERE is_closed = 1
      GROUP BY start_date, end_date
      ORDER BY start_date
    `).all()
  ]);

  const bookingEvents = (bookingsQuery.results || []).map((row) => makeEvent({
    uid: `booking-${row.id}`,
    start: row.start_date,
    end: row.end_date,
    stamp: row.confirmed_at || row.created_at,
    summary: 'Prenotazione diretta Marconi306'
  }));

  const closureEvents = (closuresQuery.results || []).map((row) => makeEvent({
    uid: `closure-${row.id}-${row.start_date}-${row.end_date}`,
    start: row.start_date,
    end: row.end_date,
    stamp: row.created_at,
    summary: 'Periodo non disponibile Marconi306'
  }));

  const body = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Marconi306//Prenotazioni dirette e chiusure//IT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Marconi306 - Disponibilita',
    ...bookingEvents,
    ...closureEvents,
    'END:VCALENDAR',
    ''
  ].join('\r\n');

  return new Response(body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="marconi306-disponibilita.ics"',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache'
    }
  });
}
