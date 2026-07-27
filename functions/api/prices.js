import { addDays } from '../_lib/booking.js';
import { pricingForDates } from '../_lib/pricing.js';
export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const start = url.searchParams.get('start');
    const end = url.searchParams.get('end');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start||'') || !/^\d{4}-\d{2}-\d{2}$/.test(end||'') || end <= start) throw new Error('Intervallo non valido.');
    const limit = addDays(start, 550);
    if (end > limit) throw new Error('Intervallo troppo esteso.');
    return Response.json({ prices: await pricingForDates(env.DB, start, end) }, { headers:{'Cache-Control':'no-store'} });
  } catch (error) { return Response.json({ error:error.message }, { status:400 }); }
}
