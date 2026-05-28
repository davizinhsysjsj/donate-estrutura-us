import type { PageServerLoad, Actions } from './$types';
import { redirect, fail } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

const COOKIE = 'dash_token';

export const load: PageServerLoad = async ({ cookies, url }) => {
  const expected = env.DASHBOARD_TOKEN;
  // Sem token configurado = libera (dev / preview)
  if (!expected) return { authed: true, token: '' };

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
  if (cookie === expected) return { authed: true, token: cookie };
  return { authed: false, token: '' };
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
