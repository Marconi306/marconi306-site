MARCONI306 v10.9 — CALENDARIO ICAL BIDIREZIONALE

URL DA IMPORTARE SU BOOKING E AIRBNB
https://marconi306.it/api/calendar.ics

COME FUNZIONA
- Il calendario non è un file statico da rigenerare.
- Ogni volta che Booking o Airbnb richiama l'URL, Cloudflare legge in tempo reale il database D1.
- Sono esportate esclusivamente le prenotazioni con stato CONFIRMED.
- Una nuova prenotazione confermata compare automaticamente nel feed.
- Una prenotazione annullata scompare automaticamente dal feed perché non è più CONFIRMED.

COMPATIBILITÀ
Resta disponibile anche il precedente indirizzo:
https://marconi306.it/api/direct-calendar.ics

CONFIGURAZIONE NECESSARIA SULLE PIATTAFORME
Perché Booking e Airbnb ricevano le prenotazioni dirette, bisogna importare l'URL sopra nelle rispettive sezioni di sincronizzazione calendario.

IMPORTANTE
La lettura del feed da parte di Booking e Airbnb non è istantanea: la frequenza di aggiornamento è decisa dalle piattaforme. Il sito Marconi306 e il database D1 si aggiornano invece immediatamente.

TEST DOPO IL DEPLOY
1. Aprire https://marconi306.it/api/calendar.ics
2. Verificare che il browser mostri o scarichi un calendario valido.
3. Creare una prenotazione di prova confermata.
4. Riaprire l'URL e verificare la presenza dell'evento.
5. Annullare la prenotazione dal pannello admin.
6. Riaprire l'URL e verificare che l'evento non sia più presente.
