# Marconi306 v10.0 — prenotazione diretta semplice

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

`migrations/0001_bookings.sql`

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
- prezzo ricalcolato e verificato dal server;
- nessun pagamento acquisito se le date risultano occupate.
