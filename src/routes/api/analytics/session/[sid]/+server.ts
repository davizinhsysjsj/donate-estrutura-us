import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { getSessionDetail, initStore } from '$lib/server/analytics';
import { env } from '$env/dynamic/private';

initStore();

function checkAuth(token: string | null): boolean {
  const expected = env.DASHBOARD_TOKEN;
  if (!expected) return true;
  return token === expected;
}

export const GET: RequestHandler = async ({ params, url, cookies }) => {
  const token = url.searchParams.get('token') || cookies.get('dash_token') || null;
  if (!checkAuth(token)) throw error(401, 'unauthorized');
  const detail = getSessionDetail(params.sid);
  if (!detail) throw error(404, 'not_found');
  return json(detail, { headers: { 'cache-control': 'no-store' } });
};
