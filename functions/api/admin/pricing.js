import { verifyAdminToken, unauthorized } from '../../_lib/admin-auth.js';
import { pricingForDates } from '../../_lib/pricing.js';
export async function onRequestGet({request,env}){
  if(!await verifyAdminToken(request,env.ADMIN_PASSWORD)) return unauthorized();
  const u=new URL(request.url), start=u.searchParams.get('start'), end=u.searchParams.get('end');
  if(!start||!end) return Response.json({error:'Date mancanti.'},{status:400});
  return Response.json({prices:await pricingForDates(env.DB,start,end)});
}
export async function onRequestPost({request,env}){
  if(!await verifyAdminToken(request,env.ADMIN_PASSWORD)) return unauthorized();
  const d=await request.json(); const start=String(d.start||''), end=String(d.end||'');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end)||end<=start) return Response.json({error:'Intervallo non valido.'},{status:400});
  const price=d.price===''||d.price==null?null:Math.round(Number(d.price)*100);
  if(price!==null && (!Number.isFinite(price)||price<0)) return Response.json({error:'Prezzo non valido.'},{status:400});
  await env.DB.prepare(`INSERT INTO pricing_rules(start_date,end_date,price_cents,is_closed,note) VALUES(?1,?2,?3,?4,?5)`).bind(start,end,price,d.closed?1:0,String(d.note||'').slice(0,250)).run();
  return Response.json({success:true,message:'Calendario aggiornato.'});
}
export async function onRequestDelete({request,env}){
  if(!await verifyAdminToken(request,env.ADMIN_PASSWORD)) return unauthorized();
  const d=await request.json(); const start=String(d.start||''), end=String(d.end||'');
  await env.DB.prepare('DELETE FROM pricing_rules WHERE start_date < ?2 AND end_date > ?1').bind(start,end).run();
  return Response.json({success:true,message:'Personalizzazioni rimosse.'});
}
