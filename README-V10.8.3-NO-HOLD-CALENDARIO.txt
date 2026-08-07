Marconi306 v10.8.3 - NO HOLD CALENDARIO

Modifica richiesta:
- I tentativi di pagamento non bloccano più le date.
- Le date restano disponibili agli altri clienti fino al pagamento riuscito.
- Il record HOLD rimane soltanto come sessione tecnica PayPal e non compare nella disponibilità.
- booking_nights viene popolata soltanto dopo capture PayPal COMPLETED.
- Prima della capture viene rifatto il controllo su Booking, Airbnb e prenotazioni dirette confermate.
- In caso eccezionale di due pagamenti quasi simultanei, il vincolo UNIQUE su booking_nights assegna le date al primo completamento; il secondo pagamento viene rimborsato automaticamente via PayPal.
- Testo del calendario aggiornato.

Non sono necessarie nuove migrazioni D1.
