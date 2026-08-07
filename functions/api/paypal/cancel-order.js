export async function onRequestPost({ request, env }) {
  try {
    if (!env.DB) throw new Error('Archivio prenotazioni non configurato.');
    const { orderID } = await request.json();
    if (!orderID) throw new Error('Ordine PayPal mancante.');

    // Nel nuovo flusso prima dell'approvazione PayPal esiste solo una sessione
    // non bloccante: cancellarla non libera date perché le date non erano state bloccate.
    const session = await env.DB.prepare(`
      SELECT id FROM checkout_sessions WHERE paypal_order_id = ?1 LIMIT 1
    `).bind(orderID).first();

    if (session) {
      await env.DB.prepare('DELETE FROM checkout_sessions WHERE id = ?1').bind(session.id).run();
    }

    // Compatibilità con eventuali vecchi HOLD ancora presenti.
    const booking = await env.DB.prepare(`
      SELECT id, status FROM bookings WHERE paypal_order_id = ?1 LIMIT 1
    `).bind(orderID).first();

    if (booking?.status === 'HOLD') {
      await env.DB.batch([
        env.DB.prepare('DELETE FROM booking_nights WHERE booking_id = ?1').bind(booking.id),
        env.DB.prepare("UPDATE bookings SET status = 'CANCELLED', hold_expires_at = NULL WHERE id = ?1 AND status = 'HOLD'").bind(booking.id)
      ]);
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('Cancel order error', error);
    return Response.json({ error: error.message || 'Impossibile annullare la sessione di pagamento.' }, { status: 400 });
  }
}
