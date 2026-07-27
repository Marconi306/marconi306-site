# Marconi306 v10.2 — prenotazione diretta semplice

Questa versione mantiene il sito statico esistente e aggiunge soltanto il flusso necessario per prenotare e pagare online.

## Cosa fa

1. Legge le indisponibilità dai calendari iCal di Booking e Airbnb.
2. Mostra prezzi e totale del soggiorno.
3. Raccoglie i dati essenziali dell’ospite.
4. Riserva le date per 10 minuti durante il pagamento.
5. Crea e acquisisce l’ordine PayPal dal server Cloudflare.
6. Registra la prenotazione confermata nel database D1.
7. Espone un calendario iCal delle prenotazioni dirette.

Non include dashboard, gestionale o automazioni aggiuntive. Le notifiche di pagamento sono quelle inviate da PayPal.

## 1 — Database D1

Creare in Cloudflare un database chiamato `marconi306-bookings`, quindi eseguire nella sua Console il file:

`migrations/0001_bookings.sql` e subito dopo `migrations/0002_booking_nights.sql`

Nel progetto Pages aggiungere il binding D1:

- nome variabile: `DB`
- database: `marconi306-bookings`

## 2 — Variabili Cloudflare

In **Settings → Variables and Secrets** aggiungere sia per Preview sia per Production:

- `PAYPAL_CLIENT_ID` — variabile normale
- `PAYPAL_CLIENT_SECRET` — secret
- `PAYPAL_MODE` — `sandbox` per i test
- `BOOKING_ICAL_URL` — URL di esportazione calendario Booking
- `AIRBNB_ICAL_URL` — URL di esportazione calendario Airbnb

Il Client Secret non deve essere inserito nei file o su GitHub.

## 3 — Sincronizzazione prenotazioni dirette

Importare su Booking e Airbnb questo calendario:

`https://marconi306.it/api/direct-calendar.ics`

La sincronizzazione iCal delle piattaforme non è istantanea. Il sito ricontrolla entrambi i calendari prima di creare l’ordine e prima di acquisire il pagamento, ma rimane il normale piccolo margine di ritardo proprio di iCal.

## 4 — Test Sandbox

1. Pubblicare il progetto.
2. Lasciare `PAYPAL_MODE=sandbox`.
3. Usare un account acquirente Sandbox PayPal.
4. Verificare in D1 che la prenotazione passi da `HOLD` a `CONFIRMED`.
5. Verificare l’URL `/api/direct-calendar.ics`.
6. Solo dopo il test sostituire Client ID e Secret con quelli Live e impostare `PAYPAL_MODE=live`.

## Regole applicate

- massimo 2 ospiti;
- pagamento anticipato del 100%;
- tassa di soggiorno esclusa dal pagamento online;
- blocco pagamento di 10 minuti;
- blocco atomico delle singole notti per ridurre il rischio di doppie prenotazioni simultanee;
- sconto del 10% calcolato anche dal server quando viene selezionato 1 ospite;
- prezzo ricalcolato e verificato dal server;
- nessun pagamento acquisito se le date risultano occupate.

## 5 — Conferma persistente ed email (v10.4)

Dopo un pagamento PayPal completato, la pagina principale viene ricaricata e mostra una conferma persistente con codice, date e importo. In questo modo il cliente non perde il messaggio quando la finestra PayPal si chiude.

La pulizia degli HOLD scaduti viene eseguita automaticamente ogni volta che il sito carica la disponibilità e prima di creare o acquisire un ordine. Gli HOLD scaduti vengono marcati `CANCELLED` e le relative notti tornano disponibili.

Le email sono facoltative e non possono mai bloccare una prenotazione già pagata. Per abilitarle aggiungere in Cloudflare:

- `RESEND_API_KEY` — secret Resend;
- `BOOKING_EMAIL_FROM` — mittente verificato, ad esempio `Marconi306 <prenotazioni@marconi306.it>`;
- `BOOKING_NOTIFICATION_EMAIL` — indirizzo che riceve la notifica della nuova prenotazione, ad esempio `viamarconi306@gmail.com`.

Senza queste tre variabili il pagamento e la prenotazione continuano a funzionare normalmente, ma non vengono inviate email personalizzate dal sito. La ricevuta PayPal resta comunque attiva.
