import { calculateStay, cleanExpiredHolds, hasConflict, hasExternalConflict, randomId, sqliteDateTime, validateGuest } from '../../_lib/booking.js';
import { paypalRequest } from '../../_lib/paypal.js';

export async function onRequestPost({ request, env }) {
  let sessionId = '';
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

    sessionId = randomId('M306-CHECKOUT');
    const expiresAt = sqliteDateTime(new Date(Date.now() + 30 * 60 * 1000));

    // L'ordine PayPal viene creato SENZA bloccare le notti nel database.
    // La disponibilità verrà ricontrollata e le notti riservate solo dopo
    // l'approvazione PayPal, immediatamente prima della capture.
    const order = await paypalRequest(env, '/v2/checkout/orders', {
      method: 'POST',
      headers: { 'PayPal-Request-Id': sessionId },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          reference_id: sessionId,
          description: `Soggiorno Marconi306 ${start} / ${end}`,
          custom_id: sessionId,
          amount: { currency_code: 'EUR', value: (stay.totalCents / 100).toFixed(2) }
        }]
      })
    });

    await env.DB.prepare(`
      INSERT INTO checkout_sessions
      (id, paypal_order_id, start_date, end_date, nights, guests, amount_cents,
       first_name, last_name, email, phone, notes, expires_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
    `).bind(
      sessionId, order.id, start, end, stay.nights, guest.guests, stay.totalCents,
      guest.firstName, guest.lastName, guest.email, guest.phone, guest.notes, expiresAt
    ).run();

    return Response.json({ id: order.id });
  } catch (error) {
    console.error('Create order error', error);
    if (sessionId && env.DB) {
      try { await env.DB.prepare('DELETE FROM checkout_sessions WHERE id = ?1').bind(sessionId).run(); } catch (_) {}
    }
    return Response.json({ error: error.message || 'Impossibile avviare il pagamento.' }, { status: 400 });
  }
}
