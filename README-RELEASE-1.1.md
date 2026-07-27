# Marconi306 Release 1.1

La Release 1.1 introduce un calendario gestionale per prezzi e disponibilità, collegato a Cloudflare D1, e aggiorna le condizioni di cancellazione.

## Migrazione D1 obbligatoria

```bash
npx wrangler d1 migrations apply <NOME_DATABASE> --remote
```

La nuova migrazione crea `pricing_rules` e aggiunge `terms_version` alle prenotazioni.

## Uso del calendario

Accedere a `/admin`, selezionare un giorno oppure un intervallo, indicare il prezzo e/o attivare **Chiudi il periodo**, quindi salvare. Il campo “Al” è incluso nel periodo selezionato.

**Rimuovi personalizzazioni** elimina le regole che interessano il periodo e ripristina le tariffe predefinite.
