import { calculateStay, cleanExpiredHolds, eachNight, hasConflict, hasExternalConflict, randomId, sqliteDateTime, validateGuest } from '../../_lib/booking.js';
import { paypalRequest } from '../../_lib/paypal.js';

export async function onRequestPost({ request, env }) {
  let bookingId = '';
  try {
    if (!env.DB) throw new Error('Archivio prenotazioni non configurato.');
    const data = await request.json();
    const start = String(data.start || '');
    const end = String(data.end || '');
    const guest = validateGuest(data);
    const stay = calculateStay(start, end, guest.guests);

    await cleanExpiredHolds(env.DB);

    // Se PayPal richiama createOrder o il cliente ritenta subito lo stesso pagamento,
    // riutilizziamo il suo HOLD ancora valido invece di scambiarlo per una prenotazione concorrente.
    const reusable = await env.DB.prepare(`
      SELECT id, paypal_order_id, amount_cents
      FROM bookings
      WHERE status = 'HOLD'
        AND hold_expires_at > datetime('now')
        AND start_date = ?1 AND end_date = ?2
        AND email = ?3 AND guests = ?4
      ORDER BY created_at DESC
      LIMIT 1
    `).bind(start, end, guest.email, guest.guests).first();

    if (reusable?.paypal_order_id && Number(reusable.amount_cents) === stay.totalCents) {
      return Response.json({ id: reusable.paypal_order_id, reused: true });
    }

    if (await hasExternalConflict(env, start, end) || await hasConflict(env.DB, start, end, reusable?.id || '')) {
      return Response.json({ error: 'Le date sono appena diventate non disponibili. Scegli un altro periodo.' }, { status: 409 });
    }

    // Un HOLD incompleto della stessa richiesta (senza ordine PayPal) viene liberato prima di riprovare.
    if (reusable?.id) {
      await env.DB.batch([
        env.DB.prepare('DELETE FROM booking_nights WHERE booking_id = ?1').bind(reusable.id),
        env.DB.prepare("UPDATE bookings SET status = 'CANCELLED', hold_expires_at = NULL WHERE id = ?1").bind(reusable.id)
      ]);
    }

    bookingId = randomId();
    const holdExpires = sqliteDateTime(new Date(Date.now() + 10 * 60 * 1000));
    const nights = eachNight(start, end);
    const statements = [
      env.DB.prepare(`
        INSERT INTO bookings
        (id, status, start_date, end_date, nights, guests, amount_cents, first_name, last_name, email, phone, notes, hold_expires_at)
        VALUES (?1, 'HOLD', ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
      `).bind(bookingId, start, end, stay.nights, guest.guests, stay.totalCents, guest.firstName, guest.lastName, guest.email, guest.phone, guest.notes, holdExpires),
      ...nights.map(day => env.DB.prepare('INSERT INTO booking_nights (stay_date, booking_id) VALUES (?1, ?2)').bind(day, bookingId))
    ];

    try {
      await env.DB.batch(statements);
    } catch (error) {
      console.error('Date lock error', error);
      return Response.json({ error: 'Le date sono appena diventate non disponibili. Scegli un altro periodo.' }, { status: 409 });
    }

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
            amount: { currency_code: 'EUR', value: (stay.totalCents / 100).toFixed(2) }
          }]
        })
      });
      await env.DB.prepare('UPDATE bookings SET paypal_order_id = ?1 WHERE id = ?2').bind(order.id, bookingId).run();
      return Response.json({ id: order.id });
    } catch (error) {
      await env.DB.batch([
        env.DB.prepare('DELETE FROM booking_nights WHERE booking_id = ?1').bind(bookingId),
        env.DB.prepare("UPDATE bookings SET status = 'CANCELLED', hold_expires_at = NULL WHERE id = ?1").bind(bookingId)
      ]);
      throw error;
    }
  } catch (error) {
    console.error('Create order error', error);
    return Response.json({ error: error.message || 'Impossibile avviare il pagamento.' }, { status: 400 });
  }
}
