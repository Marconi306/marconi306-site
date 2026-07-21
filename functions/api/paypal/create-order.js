import { calculateStay, cleanExpiredHolds, hasConflict, hasExternalConflict, randomId, validateGuest } from '../../_lib/booking.js';
import { paypalRequest } from '../../_lib/paypal.js';

export async function onRequestPost({ request, env }) {
  try {
    if (!env.DB) throw new Error('Archivio prenotazioni non configurato.');
    const data = await request.json();
    const start = String(data.start || '');
    const end = String(data.end || '');
    const guest = validateGuest(data);
    const stay = calculateStay(start, end, guest.guests);

    await cleanExpiredHolds(env.DB);
    if (await hasExternalConflict(env, start, end) || await hasConflict(env.DB, start, end)) {
      return Response.json({ error: 'Le date sono appena diventate non disponibili. Scegli un altro periodo.' }, { status: 409 });
    }

    const bookingId = randomId();
    const holdExpires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await env.DB.prepare(`
      INSERT INTO bookings
      (id, status, start_date, end_date, nights, guests, amount_cents, first_name, last_name, email, phone, notes, hold_expires_at)
      VALUES (?1, 'HOLD', ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
    `).bind(bookingId, start, end, stay.nights, guest.guests, stay.total * 100, guest.firstName, guest.lastName, guest.email, guest.phone, guest.notes, holdExpires).run();

    try {
      const order = await paypalRequest(env, '/v2/checkout/orders', {
        method: 'POST',
        headers: { 'PayPal-Request-Id': bookingId },
        body: JSON.stringify({
          intent: 'CAPTURE',
          purchase_units: [{
            reference_id: bookingId,
            description: `Soggiorno Marconi306 ${start} / ${end}`,
            custom_id: bookingId,
            amount: { currency_code: 'EUR', value: stay.total.toFixed(2) }
          }]
        })
      });
      await env.DB.prepare('UPDATE bookings SET paypal_order_id = ?1 WHERE id = ?2').bind(order.id, bookingId).run();
      return Response.json({ id: order.id });
    } catch (error) {
      await env.DB.prepare("UPDATE bookings SET status = 'CANCELLED' WHERE id = ?1").bind(bookingId).run();
      throw error;
    }
  } catch (error) {
    console.error('Create order error', error);
    return Response.json({ error: error.message || 'Impossibile avviare il pagamento.' }, { status: 400 });
  }
}
