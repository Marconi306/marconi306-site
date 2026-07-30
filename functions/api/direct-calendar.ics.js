function icalEscape(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n');
}
function dateCompact(iso) { return iso.replaceAll('-', ''); }

export async function onRequestGet({ env }) {
  if (!env.DB) return new Response('Database non configurato', { status: 503 });
  const { results = [] } = await env.DB.prepare("SELECT id, start_date, end_date, confirmed_at FROM bookings WHERE status='CONFIRMED' ORDER BY start_date").all();
  const events = results.map(row => [
    'BEGIN:VEVENT',
    `UID:${icalEscape(row.id)}@marconi306.it`,
    `DTSTAMP:${String(row.confirmed_at || '').replace(/[-: ]/g, '').slice(0, 15)}Z`,
    `DTSTART;VALUE=DATE:${dateCompact(row.start_date)}`,
    `DTEND;VALUE=DATE:${dateCompact(row.end_date)}`,
    'SUMMARY:Prenotazione diretta Marconi306',
    'END:VEVENT'
  ].join('\r\n')).join('\r\n');
  const body = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Marconi306//Prenotazioni dirette//IT','CALSCALE:GREGORIAN',events,'END:VCALENDAR'].filter(Boolean).join('\r\n');
  return new Response(body, { headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'no-store' } });
}
