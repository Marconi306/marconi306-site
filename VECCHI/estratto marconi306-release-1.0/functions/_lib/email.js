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

async function sendResendEmail(env, payload, idempotencyKey) {
  if (!env.RESEND_API_KEY || !env.BOOKING_EMAIL_FROM) return { skipped: true };

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey
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

export async function sendBookingEmails(env, booking, bookingCode, options = {}) {
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

  const guestText = `Prenotazione confermata – Marconi306\n\nGentile ${booking.first_name},\nCodice prenotazione: ${bookingCode}\nCheck-in: ${checkIn}\nCheck-out: ${checkOut}\nOspiti: ${booking.guests}\nTotale pagato: ${amount}\n\nLa tassa di soggiorno di €1 per persona per notte non è inclusa e sarà riscossa in contanti al check-in.\n\nMarconi306`;

  const ownerText = `Nuova prenotazione diretta\n\nCodice: ${bookingCode}\nOspite: ${guestName}\nEmail: ${booking.email}\nTelefono: ${booking.phone}\nCheck-in: ${checkIn}\nCheck-out: ${checkOut}\nNotti: ${booking.nights}\nOspiti: ${booking.guests}\nTotale: ${amount}\nCapture PayPal: ${booking.paypal_capture_id || ''}`;

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

  const idempotencySuffix = options.idempotencySuffix ? `-${options.idempotencySuffix}` : '';

  const sends = [
    sendResendEmail(env, {
      to: booking.email,
      subject: `Prenotazione confermata – Marconi306 – ${bookingCode}`,
      html: guestHtml,
      text: guestText,
      reply_to: env.BOOKING_NOTIFICATION_EMAIL || undefined
    }, `${booking.id}-guest-confirmation${idempotencySuffix}`)
  ];

  if (env.BOOKING_NOTIFICATION_EMAIL) {
    sends.push(sendResendEmail(env, {
      to: env.BOOKING_NOTIFICATION_EMAIL,
      subject: `Nuova prenotazione diretta – ${guestName} – ${checkIn}`,
      html: ownerHtml,
      text: ownerText,
      reply_to: booking.email
    }, `${booking.id}-owner-notification${idempotencySuffix}`));
  }

  const results = await Promise.allSettled(sends);
  const failed = results.filter(result => result.status === 'rejected');
  if (failed.length) {
    console.error('Booking email errors', failed.map(item => item.reason));
  }
  return { configured: true, sent: results.length - failed.length, failed: failed.length };
}


function cancellationCopy(reason, booking) {
  const firstName = booking.first_name || 'Ospite';
  const checkIn = formatItalianDate(booking.start_date);
  const checkOut = formatItalianDate(booking.end_date);
  const code = booking.id.split('-').slice(0, 2).join('-').toUpperCase();

  const copies = {
    overlap: {
      subject: `Annullamento della prenotazione – Marconi306 – ${code}`,
      intro: `Gentile ${firstName}, ti informiamo che, a causa della contemporanea conferma di un'altra prenotazione per le stesse date, la tua prenotazione è risultata successiva e purtroppo non è stato possibile mantenerla confermata.`,
      refund: 'L’importo versato verrà rimborsato integralmente tramite PayPal. Riceverai una conferma separata non appena il rimborso sarà stato disposto.'
    },
    guest_request: {
      subject: `Conferma annullamento prenotazione – Marconi306 – ${code}`,
      intro: `Gentile ${firstName}, come da tua richiesta abbiamo annullato la prenotazione indicata di seguito.`,
      refund: 'L’eventuale rimborso sarà calcolato in base alle condizioni di cancellazione accettate al momento della prenotazione e verrà gestito separatamente tramite PayPal.'
    },
    property_issue: {
      subject: `Annullamento della prenotazione – Marconi306 – ${code}`,
      intro: `Gentile ${firstName}, per un imprevisto della struttura non siamo purtroppo in grado di garantire il soggiorno prenotato. Ci scusiamo sinceramente per il disagio.`,
      refund: 'L’importo versato verrà rimborsato integralmente tramite PayPal. Riceverai una conferma separata non appena il rimborso sarà stato disposto.'
    }
  };
  return { ...(copies[reason] || copies.property_issue), checkIn, checkOut, code };
}

export async function sendCancellationEmails(env, booking, reason, options = {}) {
  if (!env.RESEND_API_KEY || !env.BOOKING_EMAIL_FROM) return { configured: false };
  const copy = cancellationCopy(reason, booking);
  const guestName = `${booking.first_name || ''} ${booking.last_name || ''}`.trim();
  const reasonLabels = {
    overlap: 'Sovrapposizione di prenotazioni',
    guest_request: 'Richiesta dell’ospite',
    property_issue: 'Imprevisto della struttura'
  };
  const guestText = `${copy.subject}\n\n${copy.intro}\n\nCodice: ${copy.code}\nCheck-in: ${copy.checkIn}\nCheck-out: ${copy.checkOut}\n\n${copy.refund}\n\nPer qualsiasi chiarimento siamo a disposizione.\n\nMarconi306`;
  const guestHtml = `
    <div style="font-family:Arial,sans-serif;line-height:1.65;color:#1c342a;max-width:640px;margin:auto">
      <h1 style="font-size:26px">Prenotazione annullata</h1>
      <p>${escapeHtml(copy.intro)}</p>
      <div style="background:#f5f1e9;padding:16px 18px;border-radius:12px;margin:20px 0">
        <strong>Codice:</strong> ${escapeHtml(copy.code)}<br>
        <strong>Check-in:</strong> ${escapeHtml(copy.checkIn)}<br>
        <strong>Check-out:</strong> ${escapeHtml(copy.checkOut)}
      </div>
      <p>${escapeHtml(copy.refund)}</p>
      <p>Per qualsiasi chiarimento siamo a tua disposizione.</p>
      <p>Un cordiale saluto,<br><strong>Marconi306</strong></p>
    </div>`;
  const ownerText = `Prenotazione annullata\n\nCodice: ${copy.code}\nOspite: ${guestName}\nDate: ${copy.checkIn} - ${copy.checkOut}\nMotivo: ${reasonLabels[reason] || reason}\nEmail ospite: ${booking.email}\nCapture PayPal: ${booking.paypal_capture_id || ''}\n\nATTENZIONE: l’annullamento non esegue automaticamente il rimborso PayPal.`;
  const ownerHtml = `
    <div style="font-family:Arial,sans-serif;line-height:1.65;color:#1c342a;max-width:640px;margin:auto">
      <h1 style="font-size:26px">Prenotazione annullata</h1>
      <p><strong>Codice:</strong> ${escapeHtml(copy.code)}<br>
      <strong>Ospite:</strong> ${escapeHtml(guestName)}<br>
      <strong>Date:</strong> ${escapeHtml(copy.checkIn)} – ${escapeHtml(copy.checkOut)}<br>
      <strong>Motivo:</strong> ${escapeHtml(reasonLabels[reason] || reason)}<br>
      <strong>Email ospite:</strong> ${escapeHtml(booking.email)}<br>
      <strong>Capture PayPal:</strong> ${escapeHtml(booking.paypal_capture_id || '')}</p>
      <p style="background:#fff0c9;padding:14px;border-radius:10px"><strong>Attenzione:</strong> l’annullamento ha liberato le date, ma non ha eseguito automaticamente il rimborso PayPal.</p>
    </div>`;
  const suffix = options.idempotencySuffix ? `-${options.idempotencySuffix}` : '';
  const sends = [sendResendEmail(env, {
    to: booking.email,
    subject: copy.subject,
    html: guestHtml,
    text: guestText,
    reply_to: env.BOOKING_NOTIFICATION_EMAIL || undefined
  }, `${booking.id}-guest-cancellation-${reason}${suffix}`)];
  if (env.BOOKING_NOTIFICATION_EMAIL) {
    sends.push(sendResendEmail(env, {
      to: env.BOOKING_NOTIFICATION_EMAIL,
      subject: `Prenotazione annullata – ${guestName} – ${copy.checkIn}`,
      html: ownerHtml,
      text: ownerText,
      reply_to: booking.email
    }, `${booking.id}-owner-cancellation-${reason}${suffix}`));
  }
  const results = await Promise.allSettled(sends);
  const failed = results.filter(result => result.status === 'rejected');
  if (failed.length) console.error('Cancellation email errors', failed.map(item => item.reason));
  return { configured: true, sent: results.length - failed.length, failed: failed.length };
}
