import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import { saveToken, clearToken, getTokenStatus, _resetCache } from '$lib/server/fb-token';

// Autenticacao simples — mesmo cookie do dashboard
function isAuthed(cookies: any): boolean {
  const expected = env.DASHBOARD_TOKEN;
  if (!expected) return true; // dev
  return cookies.get('dash_token') === expected;
}

export const GET: RequestHandler = async ({ cookies }) => {
  if (!isAuthed(cookies)) return json({ error: 'unauthorized' }, { status: 401 });
  return json(getTokenStatus());
};

export const POST: RequestHandler = async ({ request, cookies }) => {
  if (!isAuthed(cookies)) return json({ error: 'unauthorized' }, { status: 401 });

  let body: { token?: string; defaultAccount?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid json' }, { status: 400 });
  }

  const token = (body.token || '').trim();
  if (!token) return json({ error: 'token vazio' }, { status: 400 });
  if (token.length < 50) return json({ error: 'token muito curto (esperado >50 chars)' }, { status: 400 });
  // FB tokens comecam com EAA
  if (!/^EAA[A-Za-z0-9_-]+$/.test(token)) {
    return json({ error: 'formato invalido (token FB comeca com EAA...)' }, { status: 400 });
  }

  // Validar o token chamando /me
  try {
    const probe = await fetch(
      `https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${encodeURIComponent(token)}`,
      { signal: AbortSignal.timeout(10_000) }
    );
    const probeBody = await probe.json();
    if (!probe.ok || probeBody.error) {
      return json({
        error: probeBody?.error?.message || 'Token rejeitado pelo Facebook',
        fbError: probeBody?.error,
      }, { status: 400 });
    }

    let defaultAccount = (body.defaultAccount || '').trim();
    if (defaultAccount && !/^(?:act_)?\d{6,20}$/.test(defaultAccount)) {
      return json({ error: 'defaultAccount invalido (use act_XXXXXX ou apenas digitos)' }, { status: 400 });
    }
    if (defaultAccount && !defaultAccount.startsWith('act_')) {
      defaultAccount = 'act_' + defaultAccount.replace(/^act_/, '');
    }

    saveToken(token, defaultAccount || undefined);
    _resetCache();

    return json({
      ok: true,
      fbUser: { id: probeBody.id, name: probeBody.name },
      status: getTokenStatus(),
    });
  } catch (e: any) {
    return json({ error: e?.message || 'erro ao validar token' }, { status: 500 });
  }
};

export const DELETE: RequestHandler = async ({ cookies }) => {
  if (!isAuthed(cookies)) return json({ error: 'unauthorized' }, { status: 401 });
  clearToken();
  _resetCache();
  return json({ ok: true, status: getTokenStatus() });
};
