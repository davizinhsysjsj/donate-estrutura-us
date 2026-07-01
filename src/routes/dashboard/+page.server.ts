import type { PageServerLoad, Actions } from './$types';
import { redirect, fail } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { getPrefs } from '$lib/server/dashboard-prefs';

const COOKIE = 'dash_token';

export const load: PageServerLoad = async ({ cookies, url }) => {
  // Em VITRACK_MODE (via env OU hostname vitrack.online), o hook ja bloqueou
  // acesso sem cookie vitrack_auth. Retornamos authed=true + DASHBOARD_TOKEN
  // pras APIs internas (/api/analytics, /api/dashboard/*) que checam header.
  const isVitrackHost = url.hostname === 'vitrack.online' || url.hostname === 'www.vitrack.online';
  if (env.VITRACK_MODE === 'true' || isVitrackHost) {
    const prefs = getPrefs();
    return {
      authed: true,
      token: env.DASHBOARD_TOKEN ?? '',
      selectedAccountIds: prefs.selectedAccountIds
    };
  }

  const expected = env.DASHBOARD_TOKEN;
  // Sem token configurado = libera (dev / preview)
  if (!expected) {
    const prefs = getPrefs();
    return { authed: true, token: '', selectedAccountIds: prefs.selectedAccountIds };
  }

  // Aceita ?token=XXX e seta cookie pra navegacoes futuras
  const fromUrl = url.searchParams.get('token');
  if (fromUrl && fromUrl === expected) {
    cookies.set(COOKIE, fromUrl, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      maxAge: 60 * 60 * 24 * 30
    });
    throw redirect(303, '/dashboard');
  }

  const cookie = cookies.get(COOKIE);
  if (cookie === expected) {
    const prefs = getPrefs();
    return { authed: true, token: cookie, selectedAccountIds: prefs.selectedAccountIds };
  }
  return { authed: false, token: '', selectedAccountIds: [] };
};

export const actions: Actions = {
  login: async ({ request, cookies }) => {
    const expected = env.DASHBOARD_TOKEN;
    if (!expected) return { success: true };
    const form = await request.formData();
    const token = (form.get('token') as string) || '';
    if (token !== expected) return fail(401, { error: 'Token incorreto' });
    cookies.set(COOKIE, token, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      maxAge: 60 * 60 * 24 * 30
    });
    throw redirect(303, '/dashboard');
  }
};
