MARCONI306 - PATCH MIRATA SINCRONIZZAZIONE E CHIUSURE

File modificati:
- functions/api/direct-calendar.ics.js
- functions/api/availability.js
- functions/api/paypal/create-order.js
- functions/_lib/booking.js

Cosa corregge:
1. Il feed /api/direct-calendar.ics esporta anche i periodi chiusi nel gestionale
   (pricing_rules.is_closed = 1), oltre alle prenotazioni CONFIRMED.
2. I duplicati identici in pricing_rules vengono esportati una sola volta.
3. L'API availability include anche i periodi chiusi dal gestionale.
4. Il checkout blocca lato server le date chiuse dal gestionale, anche se il
   cliente aggira l'interfaccia.

Non modifica:
- PayPal Live e credenziali
- email automatiche
- prezzi
- dashboard
- sincronizzazione in ingresso da Airbnb e Booking

Dopo il deploy verificare:
https://marconi306.it/api/direct-calendar.ics?v=3
Il file deve contenere BEGIN:VEVENT per il periodo chiuso.
