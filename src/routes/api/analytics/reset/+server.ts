import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { reset } from '$lib/server/analytics';
import { env } from '$env/dynamic/private';

function checkAuth(token: string | null): boolean {
  const expected = env.DASHBOARD_TOKEN;
  if (!expected) return true;
  return token === expected;
}

export const POST: RequestHandler = async ({ url, cookies }) => {
  const token = url.searchParams.get('token') || cookies.get('dash_token') || null;
  if (!checkAuth(token)) throw error(401, 'unauthorized');

  const cleared = reset();
  return json({ ok: true, cleared }, { headers: { 'cache-control': 'no-store' } });
};
