import type { RequestHandler } from './$types';
import { exchangeCodeForToken, extendToLongLived, debugToken } from '$lib/server/fb-oauth';
import { saveToken } from '$lib/server/fb-token';

// HTML que roda dentro do popup. Notifica a janela pai via postMessage
// e fecha automaticamente. Funciona tanto pra sucesso quanto pra erro.
function popupHtml(payload: { ok: boolean; error?: string; expiresAt?: number | null }) {
  const json = JSON.stringify(payload).replace(/</g, '\\u003c');
  const label = payload.ok ? 'Conectado!' : 'Erro';
  const bg = payload.ok ? '#02a95c' : '#dc2626';
  return `<!doctype html><html><head><meta charset="utf-8"><title>${label} - Facebook</title>
<style>
  body { margin:0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
         display:flex; align-items:center; justify-content:center; min-height:100vh;
         background:#0a0d12; color:#e6e9ef; }
  .card { background:#11151c; border:1px solid #1f2630; border-radius:12px;
          padding:32px 40px; text-align:center; max-width:380px; }
  .icon { width:56px; height:56px; border-radius:50%; background:${bg};
          margin:0 auto 16px; display:flex; align-items:center; justify-content:center;
          font-size:28px; color:#fff; }
  h1 { margin:0 0 8px; font-size:18px; }
  p  { margin:0; color:#8b94a4; font-size:14px; line-height:1.5; }
</style></head><body>
<div class="card">
  <div class="icon">${payload.ok ? '✓' : '!'}</div>
  <h1>${payload.ok ? 'Conectado ao Facebook' : 'Falha no login'}</h1>
  <p>${payload.ok ? 'Fechando janela...' : (payload.error || 'Erro desconhecido')}</p>
</div>
<script>
  (function() {
    var msg = { type: 'fb-oauth-result', payload: ${json} };
    try { if (window.opener) window.opener.postMessage(msg, window.location.origin); } catch(e) {}
    setTimeout(function() { try { window.close(); } catch(e) {} }, ${payload.ok ? 800 : 3000});
  })();
</script>
</body></html>`;
}

function popupResponse(payload: { ok: boolean; error?: string; expiresAt?: number | null }, status = 200) {
  return new Response(popupHtml(payload), {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

export const GET: RequestHandler = async ({ url, cookies }) => {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');

  if (error) {
    return popupResponse({ ok: false, error: errorDescription || error }, 400);
  }
  if (!code) {
    return popupResponse({ ok: false, error: 'Codigo OAuth ausente' }, 400);
  }

  const expectedState = cookies.get('fb_oauth_state');
  if (!expectedState || expectedState !== state) {
    return popupResponse({ ok: false, error: 'State CSRF invalido — tente novamente' }, 400);
  }
  cookies.delete('fb_oauth_state', { path: '/' });

  try {
    const shortLived = await exchangeCodeForToken(code, url.origin);
    const longLived = await extendToLongLived(shortLived.access_token);
    const info = await debugToken(longLived.access_token);
    const expiresAt = info.expires_at && info.expires_at > 0
      ? info.expires_at * 1000
      : (longLived.expires_in ? Date.now() + longLived.expires_in * 1000 : null);

    // Busca nome do perfil FB pra exibir no dashboard
    let profileName: string | undefined;
    let profileId: string | undefined;
    try {
      const meRes = await fetch(
        `https://graph.facebook.com/v21.0/me?fields=name,id&access_token=${encodeURIComponent(longLived.access_token)}`
      );
      if (meRes.ok) {
        const me = await meRes.json();
        if (me?.name) profileName = String(me.name);
        if (me?.id) profileId = String(me.id);
      }
    } catch (e) {
      console.warn('[fb-oauth/callback] falha ao buscar /me', e);
    }

    saveToken(longLived.access_token, { expiresAt, kind: 'oauth', profileName, profileId });
    return popupResponse({ ok: true, expiresAt });
  } catch (e: any) {
    console.error('[fb-oauth/callback]', e);
    return popupResponse({ ok: false, error: e?.message || 'Erro desconhecido' }, 500);
  }
};
