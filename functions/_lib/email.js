function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatItalianDate(iso) {
  const date = new Date(`${iso}T12:00:00Z`);
  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC'
  }).format(date);
}

async function sendResendEmail(env, payload) {
  if (!env.RESEND_API_KEY || !env.BOOKING_EMAIL_FROM) return { skipped: true };

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: env.BOOKING_EMAIL_FROM,
      ...payload
    })
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Invio email non riuscito: ${response.status} ${details}`);
  }

  return response.json();
}

export async function sendBookingEmails(env, booking, bookingCode) {
  if (!env.RESEND_API_KEY || !env.BOOKING_EMAIL_FROM) {
    return { configured: false };
  }

  const amount = (Number(booking.amount_cents) / 100).toLocaleString('it-IT', {
    style: 'currency', currency: 'EUR'
  });
  const checkIn = formatItalianDate(booking.start_date);
  const checkOut = formatItalianDate(booking.end_date);
  const guestName = `${booking.first_name} ${booking.last_name}`.trim();
  const notes = booking.notes ? `<p><strong>Note:</strong> ${escapeHtml(booking.notes)}</p>` : '';

  const guestHtml = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1c342a;max-width:640px;margin:auto">
      <h1 style="font-size:26px">Prenotazione confermata</h1>
      <p>Gentile ${escapeHtml(booking.first_name)}, grazie per aver scelto <strong>Marconi306</strong>.</p>
      <p><strong>Codice prenotazione:</strong> ${escapeHtml(bookingCode)}</p>
      <p><strong>Check-in:</strong> ${escapeHtml(checkIn)}<br>
      <strong>Check-out:</strong> ${escapeHtml(checkOut)}<br>
      <strong>Ospiti:</strong> ${Number(booking.guests)}<br>
      <strong>Totale pagato:</strong> ${escapeHtml(amount)}</p>
      <p>La tassa di soggiorno di €1 per persona per notte non è inclusa e sarà riscossa in contanti al check-in.</p>
      <p>Per qualsiasi necessità puoi rispondere a questa email oppure contattarci su WhatsApp.</p>
      <p>A presto,<br><strong>Marconi306</strong></p>
    </div>`;

  const ownerHtml = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1c342a;max-width:640px;margin:auto">
      <h1 style="font-size:26px">Nuova prenotazione diretta</h1>
      <p><strong>Codice:</strong> ${escapeHtml(bookingCode)}</p>
      <p><strong>Ospite:</strong> ${escapeHtml(guestName)}<br>
      <strong>Email:</strong> ${escapeHtml(booking.email)}<br>
      <strong>Telefono:</strong> ${escapeHtml(booking.phone)}<br>
      <strong>Check-in:</strong> ${escapeHtml(checkIn)}<br>
      <strong>Check-out:</strong> ${escapeHtml(checkOut)}<br>
      <strong>Notti:</strong> ${Number(booking.nights)}<br>
      <strong>Ospiti:</strong> ${Number(booking.guests)}<br>
      <strong>Totale:</strong> ${escapeHtml(amount)}<br>
      <strong>Capture PayPal:</strong> ${escapeHtml(booking.paypal_capture_id || '')}</p>
      ${notes}
    </div>`;

  const sends = [
    sendResendEmail(env, {
      to: booking.email,
      subject: `Prenotazione confermata – Marconi306 – ${bookingCode}`,
      html: guestHtml,
      reply_to: env.BOOKING_NOTIFICATION_EMAIL || undefined
    })
  ];

  if (env.BOOKING_NOTIFICATION_EMAIL) {
    sends.push(sendResendEmail(env, {
      to: env.BOOKING_NOTIFICATION_EMAIL,
      subject: `Nuova prenotazione diretta – ${guestName} – ${checkIn}`,
      html: ownerHtml,
      reply_to: booking.email
    }));
  }

  const results = await Promise.allSettled(sends);
  const failed = results.filter(result => result.status === 'rejected');
  if (failed.length) {
    console.error('Booking email errors', failed.map(item => item.reason));
  }
  return { configured: true, sent: results.length - failed.length, failed: failed.length };
}
