CALENDARIO MARCONI306 — CONFIGURAZIONE CLOUDFLARE PAGES

1. Carica tutti i file di questo pacchetto nel repository GitHub e fai Commit + Push.
2. In Cloudflare apri: Workers & Pages > marconi306-site > Settings > Variables and Secrets.
3. Aggiungi due SECRET (non variabili in chiaro), sia per Production sia per Preview se vuoi provarle nelle anteprime:
   - BOOKING_ICAL_URL = link di esportazione iCal di Booking
   - AIRBNB_ICAL_URL = link di esportazione iCal di Airbnb
4. Salva e avvia un nuovo deploy (Retry deployment oppure un nuovo commit).
5. Verifica nel browser: https://marconi306.it/api/availability
   Deve apparire un JSON con "blockedRanges".
6. Apri il sito e prova il calendario nella sezione Prenota ora.

SICUREZZA
I due link iCal contengono token riservati. Non devono essere inseriti in index.html, script.js o GitHub.
Poiché i link sono stati condivisi in chat, dopo aver verificato che il sistema funziona è consigliato rigenerarli su Booking e Airbnb e sostituirli nei Secret di Cloudflare.

LIMITI ICAL
La sincronizzazione iCal non è istantanea. Il sito mostra quindi sempre la dicitura "disponibilità soggetta a conferma" e invia una richiesta via WhatsApp, non una prenotazione automatica.
