import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { exchangeCodeForToken, extendToLongLived, debugToken } from '$lib/server/fb-oauth';
import { saveToken } from '$lib/server/fb-token';

function htmlError(title: string, detail: string) {
  return new Response(
    `<!doctype html><meta charset="utf-8"><title>${title}</title>
     <body style="font-family:system-ui;padding:40px;max-width:600px;margin:auto;color:#1f2937">
     <h1 style="color:#dc2626">${title}</h1>
     <p>${detail}</p>
     <p><a href="/dashboard">← Voltar pro dashboard</a></p>
     </body>`,
    { status: 500, headers: { 'content-type': 'text/html; charset=utf-8' } }
  );
}

export const GET: RequestHandler = async ({ url, cookies }) => {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');

  // Usuario cancelou ou FB retornou erro
  if (error) {
    return htmlError('Login Facebook cancelado', errorDescription || error);
  }

  if (!code) {
    return htmlError('Codigo OAuth ausente', 'O Facebook nao retornou o code esperado.');
  }

  // Valida CSRF
  const expectedState = cookies.get('fb_oauth_state');
  if (!expectedState || expectedState !== state) {
    return htmlError('State CSRF invalido', 'O state retornado nao bate com o esperado. Tente conectar novamente.');
  }
  cookies.delete('fb_oauth_state', { path: '/' });

  try {
    // Etapa 1: code -> short-lived
    const shortLived = await exchangeCodeForToken(code, url.origin);

    // Etapa 2: short-lived -> long-lived (60d)
    const longLived = await extendToLongLived(shortLived.access_token);

    // Etapa 3: debug pra saber expires_at exato
    const info = await debugToken(longLived.access_token);
    const expiresAt = info.expires_at && info.expires_at > 0
      ? info.expires_at * 1000   // segundos -> ms
      : (longLived.expires_in ? Date.now() + longLived.expires_in * 1000 : null);

    // Persiste
    saveToken(longLived.access_token, { expiresAt, kind: 'oauth' });

    // Redireciona pro dashboard com flag de sucesso
    throw redirect(302, '/dashboard?fb_connected=1');
  } catch (e: any) {
    // redirect() throw nao e um erro real
    if (e?.status === 302) throw e;
    console.error('[fb-oauth/callback]', e);
    return htmlError('Falha no OAuth Facebook', e?.message || 'Erro desconhecido');
  }
};
