import { cleanExpiredHolds, hasConflict, hasExternalConflict } from '../../_lib/booking.js';
import { paypalRequest } from '../../_lib/paypal.js';
import { sendBookingEmails } from '../../_lib/email.js';

export async function onRequestPost({ request, env }) {
  try {
    if (!env.DB) throw new Error('Archivio prenotazioni non configurato.');
    const { orderID } = await request.json();
    if (!orderID) throw new Error('Ordine PayPal mancante.');

    await cleanExpiredHolds(env.DB);
    const booking = await env.DB.prepare('SELECT * FROM bookings WHERE paypal_order_id = ?1 LIMIT 1').bind(orderID).first();
    if (!booking || booking.status !== 'HOLD') throw new Error('Prenotazione non trovata o sessione scaduta.');
    if (await hasExternalConflict(env, booking.start_date, booking.end_date) || await hasConflict(env.DB, booking.start_date, booking.end_date, booking.id)) {
      await env.DB.batch([
        env.DB.prepare('DELETE FROM booking_nights WHERE booking_id = ?1').bind(booking.id),
        env.DB.prepare("UPDATE bookings SET status = 'CANCELLED' WHERE id = ?1").bind(booking.id)
      ]);
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

    await env.DB.prepare(`
      UPDATE bookings SET status = 'CONFIRMED', paypal_capture_id = ?1,
      confirmed_at = datetime('now'), hold_expires_at = NULL WHERE id = ?2
    `).bind(payment.id, booking.id).run();

    const confirmedBooking = { ...booking, status: 'CONFIRMED', paypal_capture_id: payment.id };
    const bookingCode = booking.id.split('-').slice(0, 2).join('-').toUpperCase();
    try {
      await sendBookingEmails(env, confirmedBooking, bookingCode);
    } catch (emailError) {
      // Il pagamento e la prenotazione restano confermati anche se l'email non parte.
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
