export async function onRequestPost({ request, env }) {
  try {
    if (!env.DB) throw new Error('Archivio prenotazioni non configurato.');
    const { orderID } = await request.json();
    if (!orderID) throw new Error('Ordine PayPal mancante.');

    const booking = await env.DB.prepare(`
      SELECT id, status FROM bookings WHERE paypal_order_id = ?1 LIMIT 1
    `).bind(orderID).first();

    if (!booking) return Response.json({ success: true, released: false });
    if (booking.status !== 'HOLD') return Response.json({ success: true, released: false });

    await env.DB.batch([
      env.DB.prepare('DELETE FROM booking_nights WHERE booking_id = ?1').bind(booking.id),
      env.DB.prepare("UPDATE bookings SET status = 'CANCELLED', hold_expires_at = NULL WHERE id = ?1 AND status = 'HOLD'").bind(booking.id)
    ]);

    return Response.json({ success: true, released: true });
  } catch (error) {
    console.error('Cancel order error', error);
    return Response.json({ error: error.message || 'Impossibile liberare il blocco temporaneo.' }, { status: 400 });
  }
}
