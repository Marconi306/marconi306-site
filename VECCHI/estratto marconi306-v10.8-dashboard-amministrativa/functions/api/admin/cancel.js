import { unauthorized, verifyAdminToken } from '../../_lib/admin-auth.js';

export async function onRequestPost({ request, env }) {
  if (!await verifyAdminToken(request, env.ADMIN_PASSWORD)) return unauthorized();
  if (!env.DB) return Response.json({ error: 'Database non configurato.' }, { status: 503 });

  try {
    const { id } = await request.json();
    if (!id) throw new Error('Codice prenotazione mancante.');
    const booking = await env.DB.prepare('SELECT id, status, paypal_capture_id FROM bookings WHERE id = ?1').bind(id).first();
    if (!booking) return Response.json({ error: 'Prenotazione non trovata.' }, { status: 404 });
    if (booking.status === 'CANCELLED') return Response.json({ success: true, alreadyCancelled: true });

    await env.DB.batch([
      env.DB.prepare('DELETE FROM booking_nights WHERE booking_id = ?1').bind(id),
      env.DB.prepare("UPDATE bookings SET status = 'CANCELLED', hold_expires_at = NULL WHERE id = ?1").bind(id)
    ]);

    return Response.json({
      success: true,
      refundRequired: Boolean(booking.paypal_capture_id),
      message: booking.paypal_capture_id
        ? 'Date liberate. Il rimborso PayPal, se dovuto, deve essere effettuato separatamente.'
        : 'Prenotazione annullata e date liberate.'
    });
  } catch (error) {
    console.error('Admin cancel error', error);
    return Response.json({ error: error.message || 'Impossibile annullare la prenotazione.' }, { status: 400 });
  }
}
