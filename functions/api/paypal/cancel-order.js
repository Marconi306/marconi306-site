export async function onRequestPost({ request, env }) {
  try {
    if (!env.DB) return Response.json({ success: true });
    const { orderID } = await request.json();
    if (!orderID) return Response.json({ success: true });

    // Nuovo flusso: prima dell'approvazione PayPal esiste solo una sessione
    // tecnica, che non blocca alcuna notte.
    await env.DB.prepare('DELETE FROM checkout_sessions WHERE paypal_order_id = ?1').bind(orderID).run();

    // Compatibilità con eventuali HOLD creati da versioni precedenti.
    const booking = await env.DB.prepare(`
      SELECT id FROM bookings
      WHERE paypal_order_id = ?1 AND status = 'HOLD'
      LIMIT 1
    `).bind(orderID).first();

    if (booking) {
      await env.DB.batch([
        env.DB.prepare('DELETE FROM booking_nights WHERE booking_id = ?1').bind(booking.id),
        env.DB.prepare("UPDATE bookings SET status = 'CANCELLED', hold_expires_at = NULL WHERE id = ?1").bind(booking.id)
      ]);
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('Cancel order error', error);
    return Response.json({ success: true });
  }
}
