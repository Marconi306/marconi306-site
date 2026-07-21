import { unauthorized, verifyAdminToken } from '../../_lib/admin-auth.js';
import { sendCancellationEmails } from '../../_lib/email.js';

const ALLOWED_REASONS = ['overlap', 'guest_request', 'property_issue'];

export async function onRequestPost({ request, env }) {
  if (!await verifyAdminToken(request, env.ADMIN_PASSWORD)) return unauthorized();
  if (!env.DB) return Response.json({ error: 'Database non configurato.' }, { status: 503 });

  try {
    const { id, reason = 'property_issue', sendEmail = true } = await request.json();
    if (!id) throw new Error('Codice prenotazione mancante.');
    if (!ALLOWED_REASONS.includes(reason)) throw new Error('Motivo di annullamento non valido.');

    const booking = await env.DB.prepare('SELECT * FROM bookings WHERE id = ?1').bind(id).first();
    if (!booking) return Response.json({ error: 'Prenotazione non trovata.' }, { status: 404 });
    if (booking.status === 'CANCELLED') return Response.json({ success: true, alreadyCancelled: true, message: 'Prenotazione già annullata.' });

    await env.DB.batch([
      env.DB.prepare('DELETE FROM booking_nights WHERE booking_id = ?1').bind(id),
      env.DB.prepare("UPDATE bookings SET status = 'CANCELLED', hold_expires_at = NULL WHERE id = ?1").bind(id)
    ]);

    let emailResult = { configured: false, sent: 0, failed: 0 };
    if (sendEmail && booking.email) {
      emailResult = await sendCancellationEmails(env, booking, reason, { idempotencySuffix: crypto.randomUUID() });
    }

    const emailNote = !sendEmail
      ? ' Email non inviata per scelta dell’amministratore.'
      : !emailResult.configured
        ? ' Servizio email non configurato.'
        : ` Email inviate: ${emailResult.sent}; errori: ${emailResult.failed}.`;

    return Response.json({
      success: true,
      refundRequired: Boolean(booking.paypal_capture_id),
      email: emailResult,
      message: booking.paypal_capture_id
        ? `Prenotazione annullata e date liberate. Il rimborso PayPal, se dovuto, deve essere effettuato separatamente.${emailNote}`
        : `Prenotazione annullata e date liberate.${emailNote}`
    });
  } catch (error) {
    console.error('Admin cancel error', error);
    return Response.json({ error: error.message || 'Impossibile annullare la prenotazione.' }, { status: 400 });
  }
}
