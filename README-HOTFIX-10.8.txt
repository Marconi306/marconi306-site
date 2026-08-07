MARCONI306 v10.8 - HOTFIX PRENOTAZIONI

Correzioni:
- evita il falso conflitto quando PayPal richiama/ritenta createOrder per lo stesso soggiorno;
- riutilizza un ordine PayPal già creato per lo stesso HOLD ancora valido;
- elimina lock booking_nights residui di prenotazioni CANCELLED;
- mantiene il controllo anti-doppia-prenotazione su Booking, Airbnb e D1;
- allinea il listino diretto: Nov-Mag 70 €, Giu-Lug 80 €, Ago 95 €, Set 80 €, Ott 75 €;
- aggiorna il marker cache frontend a 10.8-booking-hotfix.

PUBBLICAZIONE
Sostituire i file del repository con questo pacchetto, commit/push su main e attendere il deploy Cloudflare Pages.
Non sono richieste nuove migrazioni D1 o nuove variabili Cloudflare.
