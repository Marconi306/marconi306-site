import { unauthorized, verifyAdminToken } from '../../_lib/admin-auth.js';
import { sendBookingEmails } from '../../_lib/email.js';

export async function onRequestPost({ request, env }) {
  if (!await verifyAdminToken(request, env.ADMIN_PASSWORD)) return unauthorized();
  if (!env.DB) return Response.json({ error: 'Database non configurato.' }, { status: 503 });

  try {
    const { id } = await request.json();
    if (!id) throw new Error('Codice prenotazione mancante.');
    const booking = await env.DB.prepare('SELECT * FROM bookings WHERE id = ?1').bind(id).first();
    if (!booking) return Response.json({ error: 'Prenotazione non trovata.' }, { status: 404 });
    if (booking.status !== 'CONFIRMED') {
      return Response.json({ error: 'Le email possono essere reinviate solo per prenotazioni confermate.' }, { status: 409 });
    }
    const bookingCode = booking.id.split('-').slice(0, 2).join('-').toUpperCase();
    const result = await sendBookingEmails(env, booking, bookingCode, { idempotencySuffix: crypto.randomUUID() });
    if (!result.configured) return Response.json({ error: 'Servizio email non configurato.' }, { status: 503 });
    return Response.json({ success: true, ...result });
  } catch (error) {
    console.error('Admin resend error', error);
    return Response.json({ error: error.message || 'Impossibile reinviare le email.' }, { status: 400 });
  }
}
