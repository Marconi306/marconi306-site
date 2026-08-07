import { cleanExpiredHolds, eachNight, hasConflict, hasExternalConflict, nightsBetween, randomId, sqliteDateTime } from '../../_lib/booking.js';
import { unauthorized, verifyAdminToken } from '../../_lib/admin-auth.js';

async function auth(request, env){ return await verifyAdminToken(request, env.ADMIN_PASSWORD); }
async function ensureColumns(db){
  const info=await db.prepare('PRAGMA table_info(bookings)').all();
  const cols=new Set((info.results||[]).map(x=>x.name));
  const ops=[];
  if(!cols.has('source')) ops.push(db.prepare("ALTER TABLE bookings ADD COLUMN source TEXT NOT NULL DEFAULT 'ONLINE'"));
  if(!cols.has('payment_status')) ops.push(db.prepare("ALTER TABLE bookings ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'PAID'"));
  if(ops.length) await db.batch(ops);
}
function manualData(data){
  const start=String(data.startDate||''); const end=String(data.endDate||'');
  const nights=nightsBetween(start,end);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end)||nights<1||nights>90) throw new Error('Date del soggiorno non valide.');
  const firstName=String(data.firstName||'').trim().slice(0,80), lastName=String(data.lastName||'').trim().slice(0,80);
  if(!firstName||!lastName) throw new Error('Inserisci nome e cognome.');
  const guests=Number(data.guests); if(![1,2].includes(guests)) throw new Error('Numero di ospiti non valido.');
  const amountCents=Math.max(0,Math.round(Number(data.amount||0)*100)); if(!Number.isFinite(amountCents)) throw new Error('Importo non valido.');
  const source=String(data.source||'DIRECT').toUpperCase(); if(!['DIRECT','BOOKING','AIRBNB','OTHER','BLOCK'].includes(source)) throw new Error('Origine non valida.');
  const paymentStatus=String(data.paymentStatus||'UNPAID').toUpperCase(); if(!['PAID','UNPAID'].includes(paymentStatus)) throw new Error('Stato pagamento non valido.');
  return {start,end,nights,firstName,lastName,email:String(data.email||'').trim().toLowerCase().slice(0,160),phone:String(data.phone||'').trim().slice(0,40),guests,amountCents,source,paymentStatus,notes:String(data.notes||'').trim().slice(0,1000)};
}
async function verifyAvailability(env,d,excludeId=''){
  if(await hasConflict(env.DB,d.start,d.end,excludeId)) throw new Error('Le date si sovrappongono a una prenotazione già confermata.');
  // Per una prenotazione importata da Booking/Airbnb il relativo iCal può già contenere lo stesso soggiorno.
  if(!['BOOKING','AIRBNB'].includes(d.source) && await hasExternalConflict(env,d.start,d.end)) throw new Error('Le date risultano occupate su Booking o Airbnb.');
}

export async function onRequestGet({ request, env }) {
  if (!await auth(request,env)) return unauthorized();
  if (!env.DB) return Response.json({ error: 'Database non configurato.' }, { status: 503 });
  await ensureColumns(env.DB); await cleanExpiredHolds(env.DB);
  const url = new URL(request.url); const status=String(url.searchParams.get('status')||'ALL').toUpperCase(); const search=String(url.searchParams.get('search')||'').trim().slice(0,120);
  if(!['ALL','CONFIRMED','HOLD','CANCELLED'].includes(status)) return Response.json({error:'Filtro non valido.'},{status:400});
  const clauses=[],bindings=[]; if(status!=='ALL'){clauses.push(`status = ?${bindings.length+1}`);bindings.push(status);} if(search){const i=bindings.length+1;clauses.push(`(lower(first_name || ' ' || last_name) LIKE lower(?${i}) OR lower(email) LIKE lower(?${i}) OR lower(phone) LIKE lower(?${i}) OR lower(id) LIKE lower(?${i}))`);bindings.push(`%${search}%`);}
  const where=clauses.length?`WHERE ${clauses.join(' AND ')}`:'';
  const statement=env.DB.prepare(`SELECT id,paypal_order_id,paypal_capture_id,status,start_date,end_date,nights,guests,amount_cents,currency,first_name,last_name,email,phone,notes,hold_expires_at,created_at,confirmed_at,terms_version,source,payment_status FROM bookings ${where} ORDER BY start_date DESC,created_at DESC LIMIT 500`);
  const result=bindings.length?await statement.bind(...bindings).all():await statement.all();
  const stats=await env.DB.prepare(`SELECT SUM(CASE WHEN status='CONFIRMED' THEN 1 ELSE 0 END) confirmed,SUM(CASE WHEN status='HOLD' THEN 1 ELSE 0 END) holds,SUM(CASE WHEN status='CANCELLED' THEN 1 ELSE 0 END) cancelled,COALESCE(SUM(CASE WHEN status='CONFIRMED' THEN amount_cents ELSE 0 END),0) revenue_cents FROM bookings`).first();
  return Response.json({bookings:result.results||[],stats});
}

export async function onRequestPost({request,env}){
  if(!await auth(request,env)) return unauthorized(); if(!env.DB)return Response.json({error:'Database non configurato.'},{status:503});
  try{ await ensureColumns(env.DB); const d=manualData(await request.json()); await verifyAvailability(env,d); const id=randomId('M306-MAN'); const now=sqliteDateTime(); const nights=eachNight(d.start,d.end);
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO bookings (id,status,start_date,end_date,nights,guests,amount_cents,currency,first_name,last_name,email,phone,notes,hold_expires_at,confirmed_at,source,payment_status) VALUES (?1,'CONFIRMED',?2,?3,?4,?5,?6,'EUR',?7,?8,?9,?10,?11,NULL,?12,?13,?14)`).bind(id,d.start,d.end,d.nights,d.guests,d.amountCents,d.firstName,d.lastName,d.email,d.phone,d.notes,now,d.source,d.paymentStatus),
      ...nights.map(day=>env.DB.prepare('INSERT INTO booking_nights (stay_date,booking_id) VALUES (?1,?2)').bind(day,id))
    ]); return Response.json({ok:true,id,message:'Prenotazione manuale creata e date bloccate.'});
  }catch(error){console.error(error);return Response.json({error:error.message||'Creazione non riuscita.'},{status:400});}
}

export async function onRequestPatch({request,env}){
  if(!await auth(request,env)) return unauthorized(); if(!env.DB)return Response.json({error:'Database non configurato.'},{status:503});
  try{await ensureColumns(env.DB);const body=await request.json();const id=String(body.id||'');const current=await env.DB.prepare('SELECT * FROM bookings WHERE id=?1').bind(id).first();if(!current)throw new Error('Prenotazione non trovata.');if(current.status==='CANCELLED')throw new Error('Una prenotazione annullata non può essere modificata.');if(!String(current.source||'').startsWith('MAN') && !String(current.id).startsWith('M306-MAN')) throw new Error('Puoi modificare dalla dashboard solo le prenotazioni create manualmente.');
    const d=manualData(body);await verifyAvailability(env,d,id);const nights=eachNight(d.start,d.end);
    await env.DB.batch([env.DB.prepare('DELETE FROM booking_nights WHERE booking_id=?1').bind(id),env.DB.prepare(`UPDATE bookings SET start_date=?1,end_date=?2,nights=?3,guests=?4,amount_cents=?5,first_name=?6,last_name=?7,email=?8,phone=?9,notes=?10,source=?11,payment_status=?12 WHERE id=?13`).bind(d.start,d.end,d.nights,d.guests,d.amountCents,d.firstName,d.lastName,d.email,d.phone,d.notes,d.source,d.paymentStatus,id),...nights.map(day=>env.DB.prepare('INSERT INTO booking_nights (stay_date,booking_id) VALUES (?1,?2)').bind(day,id))]);
    return Response.json({ok:true,message:'Prenotazione aggiornata.'});
  }catch(error){console.error(error);return Response.json({error:error.message||'Modifica non riuscita.'},{status:400});}
}
