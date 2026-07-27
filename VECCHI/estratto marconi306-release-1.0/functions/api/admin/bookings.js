import { cleanExpiredHolds } from '../../_lib/booking.js';
import { unauthorized, verifyAdminToken } from '../../_lib/admin-auth.js';

export async function onRequestGet({ request, env }) {
  if (!await verifyAdminToken(request, env.ADMIN_PASSWORD)) return unauthorized();
  if (!env.DB) return Response.json({ error: 'Database non configurato.' }, { status: 503 });

  await cleanExpiredHolds(env.DB);
  const url = new URL(request.url);
  const status = String(url.searchParams.get('status') || 'ALL').toUpperCase();
  const search = String(url.searchParams.get('search') || '').trim().slice(0, 120);
  const allowed = ['ALL', 'CONFIRMED', 'HOLD', 'CANCELLED'];
  if (!allowed.includes(status)) return Response.json({ error: 'Filtro non valido.' }, { status: 400 });

  const clauses = [];
  const bindings = [];
  if (status !== 'ALL') {
    clauses.push(`status = ?${bindings.length + 1}`);
    bindings.push(status);
  }
  if (search) {
    const index = bindings.length + 1;
    clauses.push(`(
      lower(first_name || ' ' || last_name) LIKE lower(?${index}) OR
      lower(email) LIKE lower(?${index}) OR
      lower(phone) LIKE lower(?${index}) OR
      lower(id) LIKE lower(?${index})
    )`);
    bindings.push(`%${search}%`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const statement = env.DB.prepare(`
    SELECT id, paypal_order_id, paypal_capture_id, status, start_date, end_date,
      nights, guests, amount_cents, currency, first_name, last_name, email, phone,
      notes, hold_expires_at, created_at, confirmed_at
    FROM bookings
    ${where}
    ORDER BY start_date DESC, created_at DESC
    LIMIT 500
  `);
  const result = bindings.length ? await statement.bind(...bindings).all() : await statement.all();

  const stats = await env.DB.prepare(`
    SELECT
      SUM(CASE WHEN status = 'CONFIRMED' THEN 1 ELSE 0 END) AS confirmed,
      SUM(CASE WHEN status = 'HOLD' THEN 1 ELSE 0 END) AS holds,
      SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) AS cancelled,
      COALESCE(SUM(CASE WHEN status = 'CONFIRMED' THEN amount_cents ELSE 0 END), 0) AS revenue_cents
    FROM bookings
  `).first();

  return Response.json({ bookings: result.results || [], stats });
}
