import { cleanExpiredHolds, eachNight, hasConflict, hasExternalConflict, randomId, sqliteDateTime } from '../../_lib/booking.js';
import { paypalRequest } from '../../_lib/paypal.js';
import { sendBookingEmails } from '../../_lib/email.js';

async function releaseBooking(db, bookingId) {
  await db.batch([
    db.prepare('DELETE FROM booking_nights WHERE booking_id = ?1').bind(bookingId),
    db.prepare("UPDATE bookings SET status = 'CANCELLED', hold_expires_at = NULL WHERE id = ?1 AND status = 'HOLD'").bind(bookingId)
  ]);
}

export async function onRequestPost({ request, env }) {
  let bookingId = '';
  try {
    if (!env.DB) throw new Error('Archivio prenotazioni non configurato.');
    const { orderID } = await request.json();
    if (!orderID) throw new Error('Ordine PayPal mancante.');

    await cleanExpiredHolds(env.DB);
    await env.DB.prepare("DELETE FROM checkout_sessions WHERE expires_at <= datetime('now')").run();

    const session = await env.DB.prepare(`
      SELECT * FROM checkout_sessions
      WHERE paypal_order_id = ?1 AND expires_at > datetime('now')
      LIMIT 1
    `).bind(orderID).first();

    if (!session) throw new Error('Sessione di pagamento non trovata o scaduta. Riprova la prenotazione.');

    // Ricontrollo immediatamente prima di riservare le notti.
    if (await hasExternalConflict(env, session.start_date, session.end_date) ||
        await hasConflict(env.DB, session.start_date, session.end_date)) {
      await env.DB.prepare('DELETE FROM checkout_sessions WHERE id = ?1').bind(session.id).run();
      return Response.json({ error: 'Le date non sono più disponibili. Il pagamento non è stato acquisito.' }, { status: 409 });
    }

    bookingId = randomId();
    const holdExpires = sqliteDateTime(new Date(Date.now() + 5 * 60 * 1000));
    const nights = eachNight(session.start_date, session.end_date);

    // La chiave primaria booking_nights.stay_date rende atomica la riserva delle notti:
    // se un altro checkout le ha appena prese, l'intero batch fallisce e non incassiamo.
    try {
      await env.DB.batch([
        env.DB.prepare(`
          INSERT INTO bookings
          (id, paypal_order_id, status, start_date, end_date, nights, guests, amount_cents,
           first_name, last_name, email, phone, notes, hold_expires_at)
          VALUES (?1, ?2, 'HOLD', ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
        `).bind(
          bookingId, orderID, session.start_date, session.end_date, session.nights,
          session.guests, session.amount_cents, session.first_name, session.last_name,
          session.email, session.phone, session.notes, holdExpires
        ),
        ...nights.map(day => env.DB.prepare(
          'INSERT INTO booking_nights (stay_date, booking_id) VALUES (?1, ?2)'
        ).bind(day, bookingId))
      ]);
    } catch (lockError) {
      console.error('Final date lock error', lockError);
      await env.DB.prepare('DELETE FROM checkout_sessions WHERE id = ?1').bind(session.id).run();
      return Response.json({ error: 'Le date non sono più disponibili. Il pagamento non è stato acquisito.' }, { status: 409 });
    }

    let capture;
    try {
      capture = await paypalRequest(env, `/v2/checkout/orders/${encodeURIComponent(orderID)}/capture`, {
        method: 'POST',
        headers: { 'PayPal-Request-Id': `${bookingId}-capture` },
        body: '{}'
      });
    } catch (paymentError) {
      await releaseBooking(env.DB, bookingId);
      throw paymentError;
    }

    if (capture.status !== 'COMPLETED') {
      await releaseBooking(env.DB, bookingId);
      throw new Error('Il pagamento non risulta completato.');
    }

    const payment = capture.purchase_units?.[0]?.payments?.captures?.[0];
    const paidCents = Math.round(Number(payment?.amount?.value || 0) * 100);
    if (payment?.amount?.currency_code !== 'EUR' || paidCents !== session.amount_cents) {
      await releaseBooking(env.DB, bookingId);
      throw new Error('Importo del pagamento non corrispondente. Contatta Marconi306 indicando il pagamento PayPal.');
    }

    await env.DB.batch([
      env.DB.prepare(`
        UPDATE bookings
        SET status = 'CONFIRMED', paypal_capture_id = ?1,
            confirmed_at = datetime('now'), hold_expires_at = NULL
        WHERE id = ?2
      `).bind(payment.id, bookingId),
      env.DB.prepare('DELETE FROM checkout_sessions WHERE id = ?1').bind(session.id)
    ]);

    const confirmedBooking = {
      ...session,
      id: bookingId,
      paypal_order_id: orderID,
      paypal_capture_id: payment.id,
      status: 'CONFIRMED'
    };
    const bookingCode = bookingId.split('-').slice(0, 2).join('-').toUpperCase();

    try {
      await sendBookingEmails(env, confirmedBooking, bookingCode);
    } catch (emailError) {
      console.error('Booking notification error', emailError);
    }

    return Response.json({
      success: true,
      bookingCode,
      start: session.start_date,
      end: session.end_date,
      amount: (session.amount_cents / 100).toFixed(2)
    });
  } catch (error) {
    console.error('Capture order error', error);
    return Response.json({ error: error.message || 'Impossibile completare il pagamento.' }, { status: 400 });
  }
}
