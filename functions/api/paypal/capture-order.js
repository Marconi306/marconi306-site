import { cleanExpiredHolds, eachNight, hasConflict, hasExternalConflict } from '../../_lib/booking.js';
import { paypalRequest } from '../../_lib/paypal.js';
import { sendBookingEmails } from '../../_lib/email.js';

async function refundCapture(env, captureId, bookingId) {
  if (!captureId) return false;
  try {
    await paypalRequest(env, `/v2/payments/captures/${encodeURIComponent(captureId)}/refund`, {
      method: 'POST',
      headers: { 'PayPal-Request-Id': `${bookingId}-race-refund` },
      body: '{}'
    });
    return true;
  } catch (error) {
    console.error('Automatic refund error', error);
    return false;
  }
}

export async function onRequestPost({ request, env }) {
  try {
    if (!env.DB) throw new Error('Archivio prenotazioni non configurato.');
    const { orderID } = await request.json();
    if (!orderID) throw new Error('Ordine PayPal mancante.');

    await cleanExpiredHolds(env.DB);
    const booking = await env.DB.prepare('SELECT * FROM bookings WHERE paypal_order_id = ?1 LIMIT 1').bind(orderID).first();
    if (!booking || booking.status !== 'HOLD') throw new Error('Prenotazione non trovata o sessione scaduta.');

    // Fino a questo momento le date NON sono state bloccate.
    // Ricontrolliamo la disponibilità immediatamente prima di acquisire il pagamento.
    if (await hasExternalConflict(env, booking.start_date, booking.end_date) || await hasConflict(env.DB, booking.start_date, booking.end_date, booking.id)) {
      await env.DB.prepare("UPDATE bookings SET status = 'CANCELLED', hold_expires_at = NULL WHERE id = ?1").bind(booking.id).run();
      return Response.json({ error: 'Le date non sono più disponibili. Il pagamento non è stato acquisito.' }, { status: 409 });
    }

    const capture = await paypalRequest(env, `/v2/checkout/orders/${encodeURIComponent(orderID)}/capture`, {
      method: 'POST',
      headers: { 'PayPal-Request-Id': `${booking.id}-capture` },
      body: '{}'
    });
    if (capture.status !== 'COMPLETED') throw new Error('Il pagamento non risulta completato.');

    const payment = capture.purchase_units?.[0]?.payments?.captures?.[0];
    const paidCents = Math.round(Number(payment?.amount?.value || 0) * 100);
    if (payment?.amount?.currency_code !== 'EUR' || paidCents !== booking.amount_cents) {
      throw new Error('Importo del pagamento non corrispondente. Contatta Marconi306 indicando il pagamento PayPal.');
    }

    // Solo ORA, dopo il pagamento riuscito, occupiamo le notti nel database.
    // booking_nights ha stay_date UNIQUE: protegge anche da due pagamenti quasi simultanei.
    const nights = eachNight(booking.start_date, booking.end_date);
    try {
      await env.DB.batch([
        ...nights.map(day => env.DB.prepare('INSERT INTO booking_nights (stay_date, booking_id) VALUES (?1, ?2)').bind(day, booking.id)),
        env.DB.prepare(`
          UPDATE bookings SET status = 'CONFIRMED', paypal_capture_id = ?1,
          confirmed_at = datetime('now'), hold_expires_at = NULL WHERE id = ?2 AND status = 'HOLD'
        `).bind(payment.id, booking.id)
      ]);
    } catch (lockError) {
      console.error('Post-payment date lock error', lockError);
      const refunded = await refundCapture(env, payment.id, booking.id);
      await env.DB.batch([
        env.DB.prepare('DELETE FROM booking_nights WHERE booking_id = ?1').bind(booking.id),
        env.DB.prepare("UPDATE bookings SET status = 'CANCELLED', paypal_capture_id = ?1, hold_expires_at = NULL WHERE id = ?2").bind(payment.id, booking.id)
      ]);
      return Response.json({
        error: refunded
          ? 'Le date sono state prenotate da un altro cliente pochi istanti prima. Il pagamento è stato rimborsato automaticamente.'
          : 'Le date sono state prenotate da un altro cliente pochi istanti prima. Il pagamento è stato acquisito ma il rimborso automatico non è riuscito: contatta subito Marconi306.'
      }, { status: 409 });
    }

    const confirmedBooking = { ...booking, status: 'CONFIRMED', paypal_capture_id: payment.id };
    const bookingCode = booking.id.split('-').slice(0, 2).join('-').toUpperCase();
    try {
      await sendBookingEmails(env, confirmedBooking, bookingCode);
    } catch (emailError) {
      console.error('Booking notification error', emailError);
    }

    return Response.json({
      success: true,
      bookingCode,
      start: booking.start_date,
      end: booking.end_date,
      amount: (booking.amount_cents / 100).toFixed(2)
    });
  } catch (error) {
    console.error('Capture order error', error);
    return Response.json({ error: error.message || 'Impossibile completare il pagamento.' }, { status: 400 });
  }
}
