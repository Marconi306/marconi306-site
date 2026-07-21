export async function onRequestGet({ env }) {
  return Response.json({
    configured: Boolean(env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET && env.DB),
    clientId: env.PAYPAL_CLIENT_ID || '',
    mode: String(env.PAYPAL_MODE || 'sandbox').toLowerCase()
  }, { headers: { 'Cache-Control': 'no-store' } });
}
