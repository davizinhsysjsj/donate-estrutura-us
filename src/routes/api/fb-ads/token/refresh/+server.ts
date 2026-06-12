import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { extendToLongLived, debugToken } from '$lib/server/fb-oauth';
import { getFbToken, saveToken, getTokenStatus } from '$lib/server/fb-token';

// POST /api/fb-ads/token/refresh
// Tenta renovar o token long-lived atual por outro long-lived (60 dias novos).
// FB permite isso enquanto o token nao expirou.
export const POST: RequestHandler = async () => {
  const current = getFbToken();
  if (!current) return json({ ok: false, error: 'sem token salvo' }, { status: 400 });

  try {
    const extended = await extendToLongLived(current);
    const info = await debugToken(extended.access_token);
    const expiresAt = info.expires_at && info.expires_at > 0
      ? info.expires_at * 1000
      : (extended.expires_in ? Date.now() + extended.expires_in * 1000 : null);

    saveToken(extended.access_token, { expiresAt, kind: 'oauth' });
    return json({ ok: true, status: getTokenStatus() });
  } catch (e: any) {
    console.error('[token/refresh]', e);
    return json({ ok: false, error: e.message }, { status: 500 });
  }
};
