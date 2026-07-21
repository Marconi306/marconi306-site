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

export async function onRequestGet({ env }) {
  if (!env.DB) {
    return new Response('Database non configurato', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }

  const { results = [] } = await env.DB.prepare(`
    SELECT id, start_date, end_date, confirmed_at
    FROM bookings
    WHERE status = 'CONFIRMED'
    ORDER BY start_date
  `).all();

  const events = results.map((row) => [
    'BEGIN:VEVENT',
    `UID:${icalEscape(row.id)}@marconi306.it`,
    `DTSTAMP:${utcStamp(row.confirmed_at)}`,
    `DTSTART;VALUE=DATE:${dateCompact(row.start_date)}`,
    `DTEND;VALUE=DATE:${dateCompact(row.end_date)}`,
    'SUMMARY:Prenotazione diretta Marconi306',
    'STATUS:CONFIRMED',
    'TRANSP:OPAQUE',
    'END:VEVENT'
  ].join('\r\n')).join('\r\n');

  const body = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Marconi306//Prenotazioni dirette//IT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Marconi306 - Prenotazioni dirette',
    events,
    'END:VCALENDAR',
    ''
  ].filter((line) => line !== '').join('\r\n');

  return new Response(body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="marconi306-prenotazioni.ics"',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache'
    }
  });
}
