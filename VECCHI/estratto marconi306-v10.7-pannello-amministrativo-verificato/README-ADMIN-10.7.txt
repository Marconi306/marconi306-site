MARCONI306 v10.7 — PANNELLO AMMINISTRATIVO

Nuovo indirizzo:
https://marconi306.it/admin/

Prima del deploy aggiungere in Cloudflare Pages → Impostazioni → Variabili e segreti:
- Nome: ADMIN_PASSWORD
- Tipo: Segreto
- Valore: una password lunga e unica (consigliati almeno 16 caratteri)

Funzioni disponibili:
- elenco di tutte le prenotazioni;
- ricerca per nome, email, telefono o codice;
- filtri per stato;
- riepilogo prenotazioni e incasso lordo;
- dettaglio completo ospite e pagamento;
- annullamento con liberazione immediata delle date;
- reinvio email di conferma all'ospite e notifica all'host.

IMPORTANTE:
- Annullare dal pannello NON esegue automaticamente il rimborso PayPal.
- Il rimborso, quando dovuto, va effettuato separatamente dal conto PayPal Business.
- Non pubblicare né condividere ADMIN_PASSWORD.
- Il pannello non è indicizzato dai motori di ricerca.
