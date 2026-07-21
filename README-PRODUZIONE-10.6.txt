MARCONI306 v10.6 - PRODUZIONE

COSA RISOLVE
1. Il cliente vede subito la conferma dopo il pagamento, con codice prenotazione.
2. L'annullamento PayPal libera immediatamente le date.
3. Gli HOLD scaduti continuano a essere puliti automaticamente.
4. Sono incluse le email automatiche al cliente e all'host tramite Resend.

VARIABILI CLOUDFLARE GIA' NECESSARIE
PAYPAL_CLIENT_ID
PAYPAL_CLIENT_SECRET
PAYPAL_MODE=live
BOOKING_ICAL_URL
AIRBNB_ICAL_URL
Binding D1: DB

VARIABILI PER ATTIVARE LE EMAIL
RESEND_API_KEY = chiave API Resend (Secret)
BOOKING_EMAIL_FROM = Marconi306 <prenotazioni@send.marconi306.it>
BOOKING_NOTIFICATION_EMAIL = indirizzo email dell'host

NOTE
- La prenotazione resta confermata anche se l'invio email fallisce.
- Il servizio email non viene chiamato finché RESEND_API_KEY e BOOKING_EMAIL_FROM non sono impostati.
- Non è richiesta alcuna nuova migrazione D1.

PUBBLICAZIONE
Sostituire i file del repository, Commit to main, Push origin e attendere il deploy Cloudflare.
