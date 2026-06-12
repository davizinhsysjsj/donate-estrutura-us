import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { buildAuthorizeUrl, makeState, getAppCreds } from '$lib/server/fb-oauth';

export const GET: RequestHandler = async ({ url, cookies }) => {
  try {
    // Falha cedo se app creds nao configuradas
    getAppCreds();
  } catch (e: any) {
    return new Response(
      `<h1>OAuth nao configurado</h1><p>${e.message}</p><p>Configure FB_APP_ID e FB_APP_SECRET nas env vars do Railway.</p>`,
      { status: 500, headers: { 'content-type': 'text/html' } }
    );
  }

  const state = makeState();
  cookies.set('fb_oauth_state', state, {
    path: '/',
    httpOnly: true,
    secure: url.protocol === 'https:',
    sameSite: 'lax',
    maxAge: 600, // 10min pra completar o flow
  });

  const authorizeUrl = buildAuthorizeUrl(state, url.origin);
  throw redirect(302, authorizeUrl);
};
