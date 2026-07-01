import type { PageServerLoad, Actions } from './$types';
import { redirect, fail } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { getPrefs } from '$lib/server/dashboard-prefs';

const COOKIE = 'dash_token';

export const load: PageServerLoad = async ({ cookies }) => {
  // Autenticação única centralizada em hooks.server.ts (cookie vitrack_auth,
  // senha 'davizkx'). Se o request chegou aqui, o hook já validou.
  // Ainda seta cookie dash_token pras APIs internas (/api/analytics,
  // /api/dashboard/*) que verificam header — se DASHBOARD_TOKEN estiver
  // configurado como env.
  const dashToken = env.DASHBOARD_TOKEN ?? '';
  if (dashToken) {
    cookies.set(COOKIE, dashToken, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      maxAge: 60 * 60 * 24 * 30
    });
  }
  const prefs = getPrefs();
  return {
    authed: true,
    token: dashToken,
    selectedAccountIds: prefs.selectedAccountIds
  };
};

export const actions: Actions = {};
