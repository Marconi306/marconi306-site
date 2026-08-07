MARCONI306 v10.9 — PRENOTAZIONI MANUALI

Novità dashboard:
- pulsante + Nuova prenotazione;
- inserimento nome/cognome, check-in/out, ospiti, importo, origine, pagamento, email/telefono facoltativi e note;
- origini: Diretta, Booking, Airbnb, Altro, Blocco/uso personale;
- salvataggio immediato come CONFIRMED con blocco delle notti;
- controllo sovrapposizioni con prenotazioni confermate e, per Diretta/Altro/Blocco, con iCal Booking/Airbnb;
- modifica delle prenotazioni create manualmente;
- annullamento già esistente libera le date;
- blocchi calendario a 0 €;
- badge origine e stato pagamento nei dettagli;
- CSV esteso con Origine e Pagamento.

Database: l'endpoint admin aggiunge automaticamente, al primo accesso, le colonne source e payment_status se mancanti. È incluso anche migrations/0004_manual_bookings.sql come riferimento per installazioni nuove; non eseguire manualmente la migration se la dashboard è già stata aperta con questa versione.
