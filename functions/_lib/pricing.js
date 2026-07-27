import { addDays, eachNight } from './booking.js';

export const TERMS_VERSION = 'M306-2026-07-27-v1.1';

export function fallbackNightlyPrice(iso) {
  const [year, month, day] = iso.split('-').map(Number);
  if (year === 2026) {
    if (month === 7) return 85;
    if (month === 8) return day >= 10 && day <= 16 ? 120 : 100;
    if (month === 9) return 85;
    if (month === 10) return 80;
    if (month === 11) return 70;
    if (month === 12) return [24,25,26,30,31].includes(day) ? 80 : 70;
  }
  if (year === 2027 && month === 1) return day === 1 ? 80 : 70;
  return null;
}

export async function pricingForDates(db, start, end) {
  const days = eachNight(start, end);
  const map = Object.fromEntries(days.map(day => [day, { price: fallbackNightlyPrice(day), closed: false, note: '' }]));
  if (!db || !days.length) return map;
  const { results = [] } = await db.prepare(`
    SELECT id, start_date, end_date, price_cents, is_closed, note
    FROM pricing_rules
    WHERE start_date < ?2 AND end_date > ?1
    ORDER BY (julianday(end_date)-julianday(start_date)) DESC, id ASC
  `).bind(start, end).all();
  for (const rule of results) {
    const from = rule.start_date > start ? rule.start_date : start;
    const to = rule.end_date < end ? rule.end_date : end;
    for (let day = from; day < to; day = addDays(day)) {
      if (!map[day]) continue;
      if (rule.price_cents !== null) map[day].price = Number(rule.price_cents) / 100;
      map[day].closed = Boolean(rule.is_closed);
      map[day].note = rule.note || '';
    }
  }
  return map;
}

export async function calculateStayFromDb(db, start, end, guests = 2) {
  const pricesByDate = await pricingForDates(db, start, end);
  const nights = eachNight(start, end);
  const entries = nights.map(day => pricesByDate[day]);
  if (entries.some(item => item?.closed)) throw new Error('Una o più date selezionate sono chiuse.');
  const prices = entries.map(item => item?.price);
  if (!prices.every(Number.isFinite)) throw new Error('Tariffa non disponibile per le date selezionate.');
  const baseCents = prices.reduce((sum, price) => sum + Math.round(price * 100), 0);
  const discountCents = Number(guests) === 1 ? Math.round(baseCents * 0.10) : 0;
  return { nights: nights.length, baseCents, discountCents, totalCents: baseCents-discountCents };
}
