MARCONI306 — GA4 + CONSENSO COOKIE
Versione 10.9.1 — 21/08/2026

ID Google Analytics 4: G-YNDZ5Z0DG2

MODIFICHE PRINCIPALI
- Aggiunto Google Analytics 4 al sito pubblico.
- Analytics NON viene caricato finché l'utente non preme “Accetta”.
- Implementato Google Consent Mode v2 con analytics_storage negato di default.
- Le funzioni pubblicitarie Google restano negate/disattivate.
- Aggiunto banner con “Rifiuta” e “Accetta”.
- La scelta viene ricordata nel browser per massimo 6 mesi.
- Aggiunto “Gestisci cookie” per riaprire il banner e cambiare scelta.
- In caso di rifiuto/revoca vengono rimossi i cookie GA accessibili (_ga e _ga_*).
- Aggiornata la Privacy Policy con Google Analytics e la gestione del consenso.
- Nessun tag Analytics è stato aggiunto alla dashboard /admin.

FILE AGGIUNTI
- cookie-consent.js

FILE MODIFICATI
- index.html
- privacy.html
- termini-prenotazione.html
- style.css

PUBBLICAZIONE
Caricare l'intero contenuto di questa cartella nel repository GitHub di Marconi306,
sostituendo i file corrispondenti. Attendere il deploy di Cloudflare Pages.

TEST CONSIGLIATO DOPO IL DEPLOY
1. Aprire marconi306.it in una finestra anonima.
2. Verificare che compaia il banner.
3. Premere “Rifiuta”: Analytics non deve registrare la visita.
4. Aprire “Gestisci cookie” nel footer e premere “Accetta”.
5. Controllare Google Analytics > Tempo reale.

NOTA
Questa modifica gestisce il consenso specifico per Google Analytics. Il sito usa anche
servizi terzi (es. Google Translate, Elfsight e PayPal); per una verifica normativa
completa dell'intero ecosistema cookie/terze parti è opportuno valutare anche tali servizi.
