import { createAdminToken, verifyPassword } from '../../_lib/admin-auth.js';

export async function onRequestPost({ request, env }) {
  try {
    if (!env.ADMIN_PASSWORD) {
      return Response.json({ error: 'Pannello amministrativo non configurato.' }, { status: 503 });
    }
    const { password } = await request.json();
    if (!await verifyPassword(password, env.ADMIN_PASSWORD)) {
      await new Promise(resolve => setTimeout(resolve, 350));
      return Response.json({ error: 'Password non corretta.' }, { status: 401 });
    }
    return Response.json({ success: true, token: await createAdminToken(env.ADMIN_PASSWORD) });
  } catch (error) {
    console.error('Admin login error', error);
    return Response.json({ error: 'Impossibile accedere al pannello.' }, { status: 400 });
  }
}
